import ee
import geemap

Map = geemap.Map()
ee.Initialize
TerrainImage=ee.Image('NASA/NASADEM_HGT/001')
elevation=TerrainImage.select('elevation')
#Satellite Image(Sentinel-1SAR,2014-10--NOW;Sentinel-2MSI,2015-06--NOW)
s1 = ee.ImageCollection("COPERNICUS/S1_GRD")
s2 = ee.ImageCollection("COPERNICUS/S2")
#Climate Zones
 #AridRegion = ee.FeatureCollection("projects/ee-ecnu123/assets/Arid_RegionBuffer")
Map



# Panel setting
Title = ui.Label({
  'value':["Coastline Generation tool"]
})
Introduction = ui.Label({
  'value':"Step1, Draw a geometry;  Step2, button to show the computation area; Step3, Perform",
  'style': {'width': '400px', 'height': '200px', 'fontSize': '40px', 'color': '484848'}
})

DisComputeArea = ui.Button({
  'label':"Show the computation area",
  'onClick':Scope
})
PerformButton = ui.Button({
      'label':'Perform',
      'onClick':ExtractCoastline,
      #style:{position:'top-center'}
    })
Panel = ui.Panel({
  'widgets':[Title,Introduction,DisComputeArea,PerformButton],#,RecDrawing,PolyDrawing, PointDrawing,LineDrawing
  'layout':ui.Panel.Layout.Flow('vertical'),
  'style':{
    'position':'middle-left',
    'stretch':"vertical"
  }
})
Map.add(Panel)
