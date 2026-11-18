from pathlib import Path
from playwright.sync_api import sync_playwright
import re,json
root=Path(__file__).resolve().parents[1]
html=(root/'index.html').read_text();html=re.sub(r'<link[^>]*>', '',html);html=re.sub(r'<script[^>]*src="[^"]+"[^>]*>\s*</script>', '',html)
data=(root/'data.js').read_text().replace('export const ','const ')
app=(root/'app.js').read_text().replace("import {SERVICES,AREAS,PARTNERS,PERSONAS,CATEGORIES,SOURCES} from './data.js';",'').replace('export {matchScore,matchesFor,areaData,statusFor,profileSummary};','')
geo= (root/'geo_ui.js').read_text()
sample_geo={'status':'ready','retrieved_at':'2026-11-17T00:00:00Z','areas':[{'type':'Feature','geometry':{'type':'Polygon','coordinates':[[[-63.60,44.64],[-63.58,44.64],[-63.58,44.66],[-63.60,44.66],[-63.60,44.64]]]},'properties':{'id':'12090580','population':650,'lat':44.65,'lon':-63.59,'stops_within_800m':2,'nearest_stop_m':130,'evening_departures_nearby':11}}], 'stops':[{'id':'123','name':'Demo GTFS Stop','lat':44.65,'lon':-63.59,'evening_departures':15}], 'providers':[{'id':'p1','name':'Alderney Gate Public Library','category':'community','address':'60 Alderney Drive','hours_note':'Regular hours','source':'https://www.halifaxpubliclibraries.ca/locations/alderney-gate-public-library/','lat':44.65,'lon':-63.59}], 'sources':[], 'gtfs_service_date':'2026-11-17'}
sample_status={'status':'ready','areas':1,'population_2021':650,'stops':1,'providers_with_coordinates':1,'providers_listed':1,'observed_population_800m_straightline_stop_share_pct':100,'retrieved_at':'2026-11-17T00:00:00Z','gtfs_service_date':'2026-11-17','sources':[],'errors':[]}
sample_insights={'status':'ready','insights':[{'title':'Local evidence','text':'650 people in selected census area.','source':'Census'}],'caveat':'Representative centroid is not walking network.'}
sample_scenario={'pilot_weeks':8,'total_cost':1200,'household_visit_capacity':200,'cost_per_capacity_visit':6,'2021_population_with_DA_centroids_within_1km_of_target_stop':650,'warning':'Not actual visits','evidence':'Based on assumptions.'}
responses={ '/api/status':{'ready':False},'/api/geo/status':sample_status,'/api/geo/data':sample_geo,'/api/geo/insights':sample_insights,'/api/geo/scenario':sample_scenario,'/api/geo/sync':sample_status}
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':960})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='domcontentloaded')
 page.add_style_tag(content=(root/'styles.css').read_text()+'\n'+(root/'leaflet-core-local.css').read_text())
 page.evaluate('''(responses) => {
 window.fetch=async (url,opts={})=>({ok: true,json:async()=>responses[url]||{} });
 window.baseHandlers={};const map={invalidateSize(){},setView(){return this},panTo(){},remove(){},getCenter(){return {lat:44.65,lng:-63.59}},removeLayer(){}};
 const layer=()=>({addTo(){return this},on(){return this},bindTooltip(){return this},bindPopup(){return this},remove(){}});
 window.L={map:()=>{document.querySelector('#real-map').classList.add('leaflet-container');return map;},
 tileLayer:()=>({addTo(){return this},on(k,fn){window.baseHandlers[k]=fn;return this},redraw(){}}),
 circleMarker:()=>layer(),geoJSON:()=>layer(),layerGroup:()=>layer()};
 }''',responses)
 page.add_script_tag(content=data+'\n'+app+'\ninit();')
 page.add_script_tag(content='(()=>{\n'+geo+'\n})();')
 page.locator('[data-view="partner"]').first.click();page.wait_for_timeout(300)
 page.evaluate('window.baseHandlers.load()')
 page.wait_for_timeout(300)
 assert 'public feeds synchronized' in page.locator('#geo-sync-pill').inner_text().lower()
 page.locator('[data-geo-mode="population"]').click()
 assert 'Public data view' in page.locator('#geo-status').inner_text()
 page.locator('[data-geo-mode="stops"]').click()
 assert 'GTFS stops' in page.locator('#geo-status').inner_text()
 page.locator('[data-geo-mode="providers"]').click()
 assert 'Alderney Gate' in page.locator('#geo-provider-list').inner_text()
 page.locator('#geo-pilot-stop').select_option('123')
 page.locator('#geo-run-pilot').click();page.wait_for_timeout(120)
 assert '1,200' in page.locator('#geo-pilot-result').inner_text()
 page.locator('[data-geo-mode="none"]').click()
 assert 'Synthetic neighbourhood map' in page.locator('#geo-status').inner_text()
 page.screenshot(path=str(root / 'tests' / 'mock_public_data_preview.png'),full_page=True)
 print('Browser checks passed. Errors:',errors)
 assert not errors
 b.close()
