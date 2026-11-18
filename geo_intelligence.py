"""LoopLogic public-data connectors and transparent accessibility proxies.

These data are never evidence of referrals or benefit approvals. 2021 census
population is observed at DA level; stop proximity and scheduled departures are
computed from a downloaded Halifax Transit GTFS feed. They are NOT route times.
"""
from __future__ import annotations
import csv
import io
import json
import math
import os
import time
import zipfile
import datetime as dt
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode, quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'cache'
CACHE.mkdir(exist_ok=True)
ARCGIS_LAYER = 'https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/ArcGIS/rest/services/Census_2021_Dissemination_Areas/FeatureServer/0/query'
GTFS_URL = 'https://gtfs.halifax.ca/static/google_transit.zip'
# Selected public records; addresses/hours are attributed, not automatically updated.
PROVIDERS = [
 {'id':'west-food','name':'Halifax West Ecumenical Food Bank','category':'food','address':'50 Gesner Street, Halifax, Nova Scotia, Canada','hours':{'tue':[[11.75,14]]},'hours_note':'Tue distribution 11:45–14:00; appointment required','source':'https://www.halifaxwestfoodbank.ca/find-help'},
 {'id':'beacon-food','name':'Beacon House Interfaith Society','category':'food','address':'470 Cobequid Road, Lower Sackville, Nova Scotia, Canada','hours':{'mon':[[9.5,12.75]],'tue':[[9.5,12.75]],'thu':[[18,20.5]],'fri':[[9.5,12.75]]},'hours_note':'Published regular hours; call to confirm, Wed varies','source':'https://feednovascotia.ca/find-food/'},
 {'id':'north-dartmouth-food','name':'Dartmouth North Christian Food Bank','category':'food','address':'47 Farrell Street, Dartmouth, Nova Scotia, Canada','hours':{'thu':[[9.25,12]]},'hours_note':'Published Thu 09:15–12:00; confirm before visiting','source':'https://feednovascotia.ca/find-food/'},
 {'id':'westend-food','name':'Westend Community Food Bank','category':'food','address':'3495 McAlpine Avenue, Halifax, Nova Scotia, Canada','hours':{'thu':[[8.5,12]]},'hours_note':'Published Thu 08:30–12:00; confirm before visiting','source':'https://feednovascotia.ca/find-food/'},
 {'id':'alderney-lib','name':'Alderney Gate Public Library','category':'community','address':'60 Alderney Drive, Dartmouth, Nova Scotia, Canada','hours':{'mon':[[9,20]],'tue':[[9,20]],'wed':[[9,20]],'thu':[[9,20]],'fri':[[9,18]],'sat':[[9,17]],'sun':[[12,17]]},'hours_note':'Regular public-library hours; holiday exceptions possible','source':'https://www.halifaxpubliclibraries.ca/locations/alderney-gate-public-library/'},
 {'id':'keshen-lib','name':'Keshen Goodman Public Library','category':'community','address':'330 Lacewood Drive, Halifax, Nova Scotia, Canada','hours':{'mon':[[9,21]],'tue':[[9,21]],'wed':[[9,21]],'thu':[[9,21]],'fri':[[9,17]],'sat':[[10,17]],'sun':[[10,17]]},'hours_note':'Regular public-library hours; holiday exceptions possible','source':'https://www.halifaxpubliclibraries.ca/locations/keshen-goodman-public-library/'},
 {'id':'central-lib','name':'Halifax Central Library','category':'community','address':'5440 Spring Garden Road, Halifax, Nova Scotia, Canada','hours':{},'hours_note':'Confirm current hours on official page','source':'https://halifax.bibliocommons.com/v2/locations'},
]
SOURCES = [
 {'id':'census','name':'HRM / Statistics Canada 2021 dissemination areas','url':'https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/ArcGIS/rest/services/Census_2021_Dissemination_Areas/FeatureServer/0','type':'Observed geography and population, 2021'},
 {'id':'gtfs','name':'Halifax Transit official static GTFS','url':GTFS_URL,'type':'Published stop coordinates and scheduled departures, date dependent'},
 {'id':'feed','name':'Feed Nova Scotia','url':'https://feednovascotia.ca/find-food/','type':'Published provider addresses and hours; reconfirm'},
 {'id':'libraries','name':'Halifax Public Libraries','url':'https://halifax.bibliocommons.com/v2/locations','type':'Published branch addresses and hours; reconfirm'},
]
BBOX = (-63.92, 44.53, -63.35, 44.86) # Halifax/Dartmouth/Bedford/Sackville, not all rural HRM


def haversine(a,b,c,d):
    r=6371000.; p1=math.radians(a); p2=math.radians(c)
    dp=p2-p1; dl=math.radians(d-b)
    k=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return r*2*math.asin(min(1,math.sqrt(k)))


def get_url(url, timeout=25, headers=None):
    req=Request(url, headers={'User-Agent':'LoopLogic-Hackathon-Prototype/0.7 (local public-data audit; contact: use original provider source URLs)',**(headers or {})})
    with urlopen(req,timeout=timeout) as response:
        return response.read()


def fetch_da():
    features=[]; offset=0
    while True:
        q={ 'where':'1=1','geometry':','.join(map(str,BBOX)), 'geometryType':'esriGeometryEnvelope',
           'inSR':4326, 'spatialRel':'esriSpatialRelIntersects',
           'outFields':'DAUID,DAPOP2021,DARPLAT,DARPLONG,DAPOPDEN,CSDNAME',
           'returnGeometry':'true','outSR':4326,'geometryPrecision':4,'maxAllowableOffset':0.00025,
           'resultOffset':offset,'resultRecordCount':1000,'f':'geojson'}
        obj=json.loads(get_url(ARCGIS_LAYER+'?'+urlencode(q),timeout=35))
        if obj.get('error'):raise RuntimeError('ArcGIS query rejected: '+str(obj['error'].get('message')))
        batch=obj.get('features',[])
        if not isinstance(batch,list):raise RuntimeError('ArcGIS did not return GeoJSON features')
        features.extend(batch)
        if len(batch)<1000:break
        offset+=len(batch)
        if offset>12000:raise RuntimeError('Unexpectedly large census response')
    if not features: raise RuntimeError('No dissemination areas retrieved')
    # Remove geometries outside principal HRM based on reported latitude/longitude.
    result=[]
    for f in features:
        p=f.get('properties') or {}; lat=p.get('DARPLAT'); lon=p.get('DARPLONG')
        if lat is None or lon is None:continue
        if not (BBOX[1]<=float(lat)<=BBOX[3] and BBOX[0]<=float(lon)<=BBOX[2]):continue
        result.append({'type':'Feature','geometry':f.get('geometry'), 'properties':{'id':str(p.get('DAUID') or ''),'population':max(0,int(p.get('DAPOP2021') or 0)),'density':p.get('DAPOPDEN'),'lat':float(lat),'lon':float(lon),'region':p.get('CSDNAME') or 'Halifax'}})
    if not result: raise RuntimeError('DA centroids outside bounds')
    return result


def next_tuesday(today=None):
    today=today or dt.date.today(); return today+dt.timedelta(days=(1-today.weekday())%7)


def read_zip_csv(zf,name):
    if name not in zf.namelist():return []
    with zf.open(name) as raw:
        return list(csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig')))


def active_services(zf,day):
    date=day.strftime('%Y%m%d'); active=set()
    weekdays=['monday','tuesday','wednesday','thursday','friday','saturday','sunday']
    for x in read_zip_csv(zf,'calendar.txt'):
        if x.get('start_date','')<=date<=x.get('end_date','') and x.get(weekdays[day.weekday()])=='1':active.add(x['service_id'])
    for x in read_zip_csv(zf,'calendar_dates.txt'):
        if x.get('date')==date:
            if x.get('exception_type')=='1':active.add(x['service_id'])
            elif x.get('exception_type')=='2':active.discard(x['service_id'])
    return active


def gtfs_stops_and_departures(data):
    """Count scheduled departures from stops during 17:00–21:00 on an upcoming Tue.
    Not walking routes, not proof of a trip to a service, not live availability.
    """
    zf=zipfile.ZipFile(io.BytesIO(data)); day=next_tuesday(); active=active_services(zf,day)
    if not active: raise ValueError("GTFS has no scheduled service for " + day.isoformat() + "; source may be out of date")
    trip_services={r['trip_id']:r['service_id'] for r in read_zip_csv(zf,'trips.txt')}
    active_trips={tid for tid,sid in trip_services.items() if sid in active}
    stops=[]; stops_set=set()
    for r in read_zip_csv(zf,'stops.txt'):
        try:lat=float(r['stop_lat']);lon=float(r['stop_lon']);sid=str(r['stop_id'])
        except (KeyError,ValueError):continue
        if BBOX[1]-0.08<=lat<=BBOX[3]+0.08 and BBOX[0]-0.08<=lon<=BBOX[2]+0.08:
            stops.append({'id':sid,'name':r.get('stop_name','Stop'),'lat':lat,'lon':lon,'evening_departures':0});stops_set.add(sid)
    counts=defaultdict(int)
    with zf.open('stop_times.txt') as raw:
        reader=csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig'))
        for r in reader:
            if r['trip_id'] not in active_trips or r['stop_id'] not in stops_set:continue
            try:hour=int(r.get('departure_time','').split(':',1)[0])
            except ValueError:continue
            if 17<=hour<21:counts[r['stop_id']]+=1
    for stop in stops:stop['evening_departures']=counts[stop['id']]
    return stops,day.isoformat(),len(active)


def geocode_address(addr):
    # Nominatim usage policy: minimal volume, one request/second, local caching.
    q={'q':addr,'format':'jsonv2','limit':1,'countrycodes':'ca'}
    arr=json.loads(get_url('https://nominatim.openstreetmap.org/search?'+urlencode(q), timeout=15,
                            headers={'User-Agent':'LoopLogicPrototype/0.7 (research demo; https://github.com/AliJalilianNFA/community-navigator-hubhacks)'}))
    if not arr:return None
    return {'lat':float(arr[0]['lat']),'lon':float(arr[0]['lon'])}


def load_cache():
    path=CACHE/'geointelligence.json'
    if not path.exists():return {'status':'not_synced','sources':SOURCES,'message':'Public data not yet downloaded. Click Sync Public Data; synthetic demo remains available.'}
    return json.loads(path.read_text(encoding='utf8'))


def sync_public_data(force=True):
    previous=load_cache(); errors=[]; areas=previous.get('areas',[]); stops=previous.get('stops',[])
    providers=previous.get('providers',[]) or [dict(p) for p in PROVIDERS]
    if force or not areas:
        try:areas=fetch_da()
        except Exception as exc:errors.append('census: '+str(exc)[:170])
    if force or not stops:
        try:
            zipbytes=get_url(GTFS_URL,timeout=60)
            stops,service_date,service_count=gtfs_stops_and_departures(zipbytes)
            (CACHE/'halifax_transit_source_gtfs.zip').write_bytes(zipbytes)
        except Exception as exc:errors.append('GTFS: '+str(exc)[:170]);service_date=None;service_count=None
    else:
        service_date=previous.get('gtfs_service_date');service_count=previous.get('active_services')
    known={p['id']:p for p in providers}
    for p in PROVIDERS:
        if p['id'] not in known:known[p['id']]=dict(p)
    providers=list(known.values())
    for provider in providers:
        if 'lat' in provider and 'lon' in provider:continue
        try:
            geo=geocode_address(provider['address'])
            if geo:provider.update(geo);provider['geocode_method']='Nominatim address match (verify on map)'
            else:provider['geocode_method']='not resolved'
        except Exception as exc:errors.append('geocode '+provider['id']+': '+str(exc)[:80])
        time.sleep(1.05)
    # The full data is cached; only derived summaries are sent to the AI.
    status='ready' if areas and stops else 'partial' if (areas or stops) else 'unavailable'
    for a in areas:
        p=a['properties']; lat=p['lat'];lon=p['lon']
        near=[s for s in stops if abs(s['lat']-lat)<0.015 and abs(s['lon']-lon)<0.025 and haversine(lat,lon,s['lat'],s['lon'])<=800]
        p['stops_within_800m']=len(near) if stops else None
        p['evening_departures_nearby']=sum(s['evening_departures'] for s in near) if stops else None
        p['nearest_stop_m']=round(min((haversine(lat,lon,s['lat'],s['lon']) for s in stops),default=float('inf'))) if stops else None
    obj={'status':status,'retrieved_at':dt.datetime.now(dt.timezone.utc).isoformat(), 'sources':SOURCES,
         'areas':areas,'stops':stops,'providers':providers,'errors':errors,
         'gtfs_service_date':service_date,'active_services':service_count,
         'warnings':['Census data: observed 2021 populations; not current counts.','800 m is straight-line proximity to stops, not pedestrian-network walking distance.','Evening GTFS departure counts are not proof of reachable providers, route travel times or capacity.','Provider hours are published reference information and can change; reconfirm before visiting.','Synthetic gap scores/requests are not official statistics.']}
    (CACHE/'geointelligence.json').write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    return summary(obj)


def summary(obj=None):
    d=obj or load_cache(); areas=d.get('areas',[]); stops=d.get('stops',[]); providers=d.get('providers',[])
    pop=sum(a['properties'].get('population',0) for a in areas)
    known=[a for a in areas if a['properties'].get('stops_within_800m') is not None]
    covered=sum(a['properties']['population'] for a in known if a['properties'].get('stops_within_800m',0)>0)
    base=sum(a['properties']['population'] for a in known)
    return {'status':d.get('status','not_synced'),'retrieved_at':d.get('retrieved_at'),'areas':len(areas),'population_2021':pop,
            'stops':len(stops),'providers_with_coordinates':sum(1 for p in providers if p.get('lat') is not None),
            'providers_listed':len(providers),'observed_population_800m_straightline_stop_share_pct':round(100*covered/base,1) if base else None,
            'gtfs_service_date':d.get('gtfs_service_date'),'errors':d.get('errors',[]),'sources':SOURCES,'warnings':d.get('warnings',[])}


def export_public():
    d=load_cache(); return {'status':d.get('status','not_synced'),'retrieved_at':d.get('retrieved_at'),
                            'areas':d.get('areas',[]),'stops':d.get('stops',[]),'providers':d.get('providers',[]),
                            'gtfs_service_date':d.get('gtfs_service_date'),'sources':SOURCES,'warnings':d.get('warnings',[])}


def planning_insights():
    d=load_cache(); s=summary(d); a=d.get('areas',[]); p=d.get('providers',[])
    if not a:return {'status':'not_synced','insights':[],'caveat':'Download census data first; no real-data findings available.'}
    covered=[f for f in a if f['properties'].get('stops_within_800m') is not None]
    no_stop=[f for f in covered if f['properties'].get('stops_within_800m')==0]
    no_stop_pop=sum(x['properties']['population'] for x in no_stop)
    food=[x for x in p if x.get('category')=='food' and x.get('lat') is not None]
    hrs=sum(max(0,b-a) for x in food for day,intervals in x.get('hours',{}).items() for a,b in intervals if day in ('mon','tue','wed','thu','fri') and b>17 for a,b in [[max(a,17),b]])
    return {'status':s['status'],'facts':{'2021_population_no_stop_within_800m_straightline':no_stop_pop,'areas_without_nearby_stops':len(no_stop),'geocoded_food_providers':len(food),'listed_food_providers_after_17h_weekdays':sum(1 for x in food if any(d in ('mon','tue','wed','thu','fri') and h2>17 for d,spans in x.get('hours',{}).items() for h1,h2 in spans))},
            'insights':[{'title':'Investigate first/last-mile access','text':f'{no_stop_pop:,} people in 2021 census areas had no listed transit stop within 800 m of the representative DA point in the downloaded feed. This is a proximity screening signal, not actual residents lacking bus access.','source':'2021 census DA + Halifax Transit GTFS'},
                        {'title':'Test after-work food access with partners','text':f'Of {len(food)} geocoded food providers in the small curated reference list, {sum(1 for x in food if any(d in ("mon","tue","wed","thu","fri") and h2>17 for d,spans in x.get("hours",{}).items() for h1,h2 in spans))} show published weekday time after 17:00. The directory is not complete; verify operating hours and consent before planning a pilot.','source':'Provider published reference hours'}],
            'caveat':'Analysis uses a limited provider sample, straight-line distances, 2021 population and scheduled service only. No verified transit-to-provider itineraries or observed unmet demand.'}


def scenario(weeks=8,cost=150,capacity=25,stop_id=None):
    data=load_cache(); weeks=max(1,min(52,int(weeks)));cost=max(0,min(20000,float(cost)));capacity=max(1,min(1000,int(capacity)))
    stops=data.get('stops',[]); target=next((s for s in stops if s['id']==stop_id),None) if stop_id else None
    pop_near=0
    if target:
        pop_near=sum(a['properties'].get('population',0) for a in data.get('areas',[])
                     if haversine(a['properties']['lat'],a['properties']['lon'],target['lat'],target['lon'])<=1000)
    return {'pilot_weeks':weeks,'cost_per_session':cost,'capacity_per_session':capacity,
            'total_cost':round(weeks*cost,2),'household_visit_capacity':weeks*capacity,
            'cost_per_capacity_visit':round(cost/capacity,2),'target_stop':target,
            '2021_population_with_DA_centroids_within_1km_of_target_stop':pop_near if target else None,
            'evidence':'Cost and throughput use user-set assumptions; population uses 2021 DA centroids and a radial distance if a transit stop is selected.',
            'warning':'Capacity is not observed utilization or confirmed unique households. Straight-line proximity is not bus reachability.'}


def _minutes(stamp):
    try:
        hours,mins,*rest=[int(x) for x in stamp.split(':')]
        return hours*60+mins
    except Exception:return None


def direct_gtfs_journey(da_id, provider_id, day_text=None, limit_minutes=45):
    """Schedule-aware *direct-trip* exploratory check, not a full itinerary router.

    Includes up to 800m straight-line approach/egress walking at 4.5 km/h,
    an in-vehicle direct GTFS trip and the provider's reference opening hours.
    No transfers, pedestrian networks, service alerts or waiting-time forecast.
    """
    data=load_cache(); origin=next((f['properties'] for f in data.get('areas',[]) if f['properties'].get('id')==da_id),None)
    target=next((f for f in data.get('providers',[]) if f.get('id')==provider_id),None)
    if not origin or not target:return {'status':'invalid_selection','message':'Select a valid DA and provider from the public data.'}
    if target.get('lat') is None or target.get('lon') is None:
        return {'status':'unlocated_provider','message':'Provider location is not geocoded; no scheduled journey check is possible.'}
    archive=CACHE/'halifax_transit_source_gtfs.zip'
    if not archive.exists():return {'status':'gtfs_missing','message':'Download the official GTFS feed using Sync public data.'}
    date=dt.date.fromisoformat(day_text) if day_text else next_tuesday()
    if not (dt.date.today()-dt.timedelta(days=2)<=date<=dt.date.today()+dt.timedelta(days=30)):
        raise ValueError('Service date must be within the next 30 days')
    weekday=['mon','tue','wed','thu','fri','sat','sun'][date.weekday()]
    hours=target.get('hours',{}).get(weekday,[])
    if not hours:return {'status':'no_published_hours','date':date.isoformat(),'message':'This provider has no confirmed published hours on the selected date. Check the source.'}
    origin_stops={s['id']:haversine(origin['lat'],origin['lon'],s['lat'],s['lon']) for s in data.get('stops',[])
                  if abs(s['lat']-origin['lat'])<.012 and abs(s['lon']-origin['lon'])<.02 and haversine(origin['lat'],origin['lon'],s['lat'],s['lon'])<=800}
    dest_stops={s['id']:haversine(target['lat'],target['lon'],s['lat'],s['lon']) for s in data.get('stops',[])
                if abs(s['lat']-target['lat'])<.012 and abs(s['lon']-target['lon'])<.02 and haversine(target['lat'],target['lon'],s['lat'],s['lon'])<=800}
    if not origin_stops or not dest_stops:return {'status':'no_nearby_stops','date':date.isoformat(),'message':'No listed GTFS stops are within the 800m radial search at origin or provider.'}
    with zipfile.ZipFile(archive) as zf:
        active=active_services(zf,date)
        if not active:return {'status':'no_active_schedule','date':date.isoformat(),'message':'GTFS feed has no active schedules for this date; source may be stale.'}
        allowed={t['trip_id'] for t in read_zip_csv(zf,'trips.txt') if t.get('service_id') in active}
        seen=defaultdict(lambda:{'from':[],'to':[]})
        with zf.open('stop_times.txt') as raw:
            for row in csv.DictReader(io.TextIOWrapper(raw,encoding='utf-8-sig')):
                tid=row.get('trip_id'); sid=row.get('stop_id')
                if tid not in allowed or sid not in origin_stops and sid not in dest_stops:continue
                arr=_minutes(row.get('arrival_time',''));dep=_minutes(row.get('departure_time',''))
                if arr is None or dep is None:continue
                seq=int(row.get('stop_sequence') or 0)
                if sid in origin_stops:seen[tid]['from'].append((seq,dep,sid))
                if sid in dest_stops:seen[tid]['to'].append((seq,arr,sid))
    valid=[]
    for tid,parts in seen.items():
        for i,dep,fromstop in parts['from']:
            if not 16*60<=dep<=21*60:continue
            for j,arr,tostop in parts['to']:
                if j<=i or arr<dep:continue
                walk1=origin_stops[fromstop]/75;walk2=dest_stops[tostop]/75
                minutes=(arr-dep)+walk1+walk2
                arrival_hour=(arr+walk2)/60
                if minutes<=limit_minutes and any(start<=arrival_hour<=end for start,end in hours):
                    valid.append({'from_stop':fromstop,'to_stop':tostop,'departure_local':f'{dep//60:02}:{dep%60:02}',
                                  'arrival_local':f'{arr//60:02}:{arr%60:02}','travel_minutes_excluding_wait':round(minutes,1),
                                  'walk_to_stop_m':round(origin_stops[fromstop]),'walk_from_stop_m':round(dest_stops[tostop])})
    valid.sort(key=lambda x:x['travel_minutes_excluding_wait'])
    return {'status':'direct_scheduled_candidates' if valid else 'none_found','date':date.isoformat(),'da_id':da_id,'provider_id':provider_id,
            'direct_options_found':len(valid),'fastest':valid[:3],
            'warning':'This is a direct bus/GTFS screening, not a guaranteed accessible journey. Walking is straight-line at 4.5 km/h; no actual sidewalk routes, transfers, wait-to-depart, real-time alerts, holiday-hour updates or capacity are modeled. A zero result does not prove the service is inaccessible.'}
