import unittest
import io
import zipfile
from unittest.mock import patch
import datetime as dt
import geo_intelligence as g

def sample_zip():
    mem=io.BytesIO()
    with zipfile.ZipFile(mem,'w') as z:
        z.writestr('stops.txt','stop_id,stop_name,stop_lat,stop_lon\nS1,Test Stop,44.65,-63.59\nS2,Far Stop,50,-70\n')
        z.writestr('calendar.txt','service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,1,1,1,1,1,0,0,20260101,20271231\n')
        z.writestr('trips.txt','trip_id,service_id\nT1,W\n')
        z.writestr('stop_times.txt','trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,17:15:00,17:15:00,S1,1\nT1,22:00:00,22:00:00,S1,2\n')
    return mem.getvalue()

class GISIntegrationTests(unittest.TestCase):
    def test_haversine(self):
        self.assertEqual(g.haversine(44.65,-63.59,44.65,-63.59),0)
        self.assertGreater(g.haversine(44.65,-63.59,44.66,-63.59),1000)
    def test_gtfs_counts_only_active_evening_departure(self):
        stops,date,service_count=g.gtfs_stops_and_departures(sample_zip())
        self.assertEqual(len(stops),1)
        self.assertEqual(stops[0]['evening_departures'],1)
        self.assertEqual(service_count,1)
    def test_gtfs_respects_removed_service(self):
        mem=io.BytesIO()
        with zipfile.ZipFile(mem,'w') as z:
            z.writestr('calendar.txt','service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,0,0,0,0,0,0,0,20260101,20271231\n')
            z.writestr('calendar_dates.txt','service_id,date,exception_type\nW,20261117,1\n')
        with zipfile.ZipFile(io.BytesIO(mem.getvalue())) as z:self.assertIn('W',g.active_services(z,dt.date(2026,11,17)))
    def test_public_sources(self):
        self.assertTrue(g.GTFS_URL.startswith('https://gtfs.halifax.ca'))
        self.assertIn('Census_2021_Dissemination_Areas',g.ARCGIS_LAYER)
        self.assertTrue(all('source' in p and 'address' in p for p in g.PROVIDERS))
    def test_arcgis_query(self):
        obj={'type':'FeatureCollection','features':[{'type':'Feature','properties':{'DAUID':'12090580','DARPLAT':44.65,'DARPLONG':-63.59,'DAPOP2021':600},'geometry':{'type':'Polygon','coordinates':[[[-63.6,44.6],[-63.5,44.6],[-63.6,44.7],[-63.6,44.6]]]}}]}
        with patch.object(g,'get_url',return_value=__import__('json').dumps(obj).encode('utf-8')):
            features=g.fetch_da()
        self.assertEqual(features[0]['properties']['population'],600)
        self.assertEqual(features[0]['properties']['id'],'12090580')
    def test_direct_gtfs_single_trip_when_provider_open(self):
        import tempfile, json
        from pathlib import Path
        with tempfile.TemporaryDirectory() as tmp:
            datazip=io.BytesIO()
            with zipfile.ZipFile(datazip,'w') as z:
                z.writestr('stops.txt','stop_id,stop_name,stop_lat,stop_lon\nS1,Origin,44.65,-63.59\nS2,Destination,44.66,-63.58\n')
                z.writestr('calendar.txt','service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nW,1,1,1,1,1,0,0,20260101,20271231\n')
                z.writestr('trips.txt','trip_id,service_id\nT1,W\n')
                z.writestr('stop_times.txt','trip_id,arrival_time,departure_time,stop_id,stop_sequence\nT1,17:15:00,17:15:00,S1,1\nT1,17:35:00,17:35:00,S2,2\n')
            cache=Path(tmp);(cache/'halifax_transit_source_gtfs.zip').write_bytes(datazip.getvalue())
            blob={'areas':[{'properties':{'id':'A','lat':44.65,'lon':-63.59,'population':600}}],
                  'providers':[{'id':'B','lat':44.66,'lon':-63.58,'hours':{'tue':[[17,19]]}}],
                  'stops':[{'id':'S1','name':'Origin','lat':44.65,'lon':-63.59},{'id':'S2','name':'Dest','lat':44.66,'lon':-63.58}]}
            with patch.object(g,'CACHE',cache),patch.object(g,'load_cache',return_value=blob),patch.object(g,'next_tuesday',return_value=dt.date(2026,11,17)):
                r=g.direct_gtfs_journey('A','B','2026-11-17')
            # Date guard prevents evaluating historic trips; use mocked today for this exact fixture.
            self.assertEqual(r['status'],'direct_scheduled_candidates')
            self.assertEqual(r['direct_options_found'],1)

    def test_scenario_computation(self):
        with patch.object(g,'load_cache',return_value={'areas':[],'stops':[]}):
            r=g.scenario(8,150,15)
        self.assertEqual(r['total_cost'],1200)
        self.assertEqual(r['household_visit_capacity'],120)
        self.assertEqual(r['cost_per_capacity_visit'],10)
        self.assertIn('not observed',r['warning'])
if __name__=='__main__':unittest.main()
