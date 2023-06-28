//Data preparation
/*DEM*/ 
var TerrainImage=ee.Image('NASA/NASADEM_HGT/001');
var elevation=TerrainImage.select('elevation');
//Satellite Image(Sentinel-1SAR,2014-10--NOW;Sentinel-2MSI,2015-06--NOW)
var s1 = ee.ImageCollection("COPERNICUS/S1_GRD"),
    s2 = ee.ImageCollection("COPERNICUS/S2");
//Climate Zones
 var AridRegion = ee.FeatureCollection("projects/ee-ecnu123/assets/Arid_RegionBuffer")

//Panel setting(ROI mapping methods, Date, Introduction text)
//clear screen
var Title = ui.Label({
  value:["Coastline Generation tool"]
})
var Introduction = ui.Label({
  value:"Step1, Draw a geometry;  Step2, button to show the computation area; Step3, Perform",
  style: {width: '400px', height: '200px', fontSize: '40px', color: '484848'}
})

var DrawingTools = Map.drawingTools()
// DrawingTools.setShown(false);
function ClearScreen(){
 while(Map.layers().length()>0){
    Map.layers().remove(Map.layers().get(0));
    }
  while(DrawingTools.layers().length()>0){
    var TempLayer=DrawingTools.layers().get(0);
    DrawingTools.layers().remove(TempLayer);
    TempLayer.geometries().remove(TempLayer.geometries().get(0));
    }
}
ClearScreen()

function drawRectangle() {
  ClearScreen();
  // Map.clear()
  // while(Map.layers().length()>0){
  //     Map.layers().remove(Map.layers().get(0));
  //   }
  DrawingTools.setShape('rectangle');
  DrawingTools.draw();
}

function drawPolygon() {
  ClearScreen();
  DrawingTools.setShape('polygon');
  DrawingTools.draw();
}

function drawPoint() {
  ClearScreen();
  DrawingTools.setShape('point');
  DrawingTools.draw();
}

function drawLine(){
  ClearScreen();
  DrawingTools.setShape('line');
  DrawingTools.draw();
}
var symbol = {
  rectangle: '⬛',
  polygon: '🔺',
  point: '📍',
  line:'╱'
};

var RecDrawing = ui.Button({
  label:symbol.rectangle+"____" + "Drawing Rectangle",
  onClick:drawRectangle,
})
var PolyDrawing = ui.Button({
  label:symbol.polygon+"____" + "Drawing Polygon",
  onClick:drawPolygon,
})

var PointDrawing = ui.Button({
  label:symbol.point+"____" + "Drawing Point",
  onClick:drawPoint,
})
var LineDrawing = ui.Button({
  label:symbol.line+"____" + "Drawing Line",
  onClick:drawLine,
})
var DisComputeArea = ui.Button({
  label:"Show the computation area",
  onClick:Scope
})
var PerformButton = ui.Button({
      label:'Perform',
      onClick:ExtractCoastline,
      //style:{position:'top-center'}
    })
var Panel = ui.Panel({
  widgets:[Title,Introduction,DisComputeArea,PerformButton],//,RecDrawing,PolyDrawing, PointDrawing,LineDrawing
  layout:ui.Panel.Layout.Flow('vertical'),
  style:{
    position:'middle-left',
    stretch:"vertical"
  }
})
Map.add(Panel)

// Generating the computation area
function Scope(){
  var temp=0
  while(DrawingTools.layers().length()>temp)
  {
  var Geometry = DrawingTools.layers().get(0).getEeObject()
  var GeoType = Geometry.type().getInfo()
  print(GeoType)
  if (GeoType == "Polygon"){
    var scope=Geometry.buffer(1000)
  }
  if (GeoType == "Point"){
    var scope=Geometry.buffer(10000).bounds()
  }
  if (GeoType == "LineString"){
    var scope=Geometry.buffer(2500)
  }
    temp=temp+1;
  }
  
  var empty = ee.Image().byte();
  var scopeRegion = empty.paint({
  featureCollection: scope,
  color: 1,
  width: 1
  });
  
  
  Map.centerObject(scope,13)
  Map.addLayer(scope,{},'scopeRegion',false)
  Map.addLayer(scopeRegion, {palette: '0000FF'}, 'scopeRegion');
  // ExtractCoastline(scope)
}


function ExtractCoastline(){
  var testarea = Map.layers().get(0).getEeObject().geometry()

  //***********Terrain Information
  var slope=ee.Terrain.slope( elevation)
  Map.addLayer(slope,{},"Terrain",false)
  var low_land=slope.lt(5).focalMax({radius:2.5,kernelType:"square"})
   .focalMin({radius:2.5,iterations:2,kernelType:"square"})
   .focalMax({radius:2.5,kernelType:"square"})
   var hill_land=slope.gt(30)
   
   //************************Climate Zone
   var AridRegions=ee.Image(1).byte().clip(AridRegion)
  var Conditions=AridRegions.reduceRegion(
    {
      reducer:ee.Reducer.mean(),
      geometry:testarea,
      scale:10,
      tileScale:4
    }
    )
    .get("constant").getInfo()
   
  //*********************Optical land
  var imgCol_s2=s2.filterBounds(testarea)
  .filterDate("2022-01-01",'2022-12-31')
  .filterMetadata("CLOUDY_PIXEL_PERCENTAGE",'less_than',60)
  .sort("CLOUDY_PIXEL_PERCENTAGE",false)
  .map(maskS2clouds)
  .map(function(image){
    return image.clip(testarea)
  })
  .map(function(image){
    var ndwi=image.normalizedDifference(['B3','B8']).rename("ndwi")
    var ndvi=image.normalizedDifference(['B8','B4']).rename('ndvi')
    // var mndwi=image.normalizedDifference(['B3','B11']).rename('mndwi')
    return image.addBands(ndwi).addBands(ndvi)//.addBands(mndwi)
    })
//   ////.mosaic()
  Map.addLayer( imgCol_s2,{bands:['B4','B3','B2'],max:3000,min:700},'B432',false)
  var ndwi_HighMean=imgCol_s2.select('ndwi')
  .reduce(ee.Reducer.intervalMean(90,100))
  Map.addLayer(ndwi_HighMean,{max:0.5,min:-0.5},"ndwi_HighMean",false);

  var ndvi_mean = imgCol_s2.select('ndvi')
  .reduce(ee.Reducer.intervalMean(50,100))

  Map.addLayer(ndvi_mean,{max:0.5,min:0},"ndvi_HighMean",false)
  // Map.addLayer(ndvi_Highmean)

//     //**********texture information
  var texture_img = ndwi_HighMean
  .convolve(ee.Kernel.laplacian8({magnitude:1,normalize:true}))
      .convolve(ee.Kernel.gaussian({radius:1.5}))
  .reproject({crs:ndwi_HighMean.projection(),scale:10})
// Map.addLayer(texture_img,{},"texture_img")
    var Optical_img_texture = ndwi_HighMean.subtract(texture_img.multiply(20))
    .reproject({crs:ndwi_HighMean.projection(),scale:10})

  
    Map.addLayer(Optical_img_texture,{},"Optical_img_texture",false)
  
  var Hist_Optical=Optical_img_texture//.updateMask(low_land)
  .reduceRegion({
        reducer: ee.Reducer.histogram(30)
        .combine('mean', null, true)
        .combine('variance', null, true), 
        geometry:testarea, 
        scale: 30,
        bestEffort: true,
        tileScale:16
        });
  // print(Hist_Optical,'Hist_Optical')
  
  var threshold_Optical = otsu(Hist_Optical.get("ndwi_mean_histogram"));
  
  if(threshold_Optical.getInfo()<0){
    threshold_Optical=0
  }
  print(threshold_Optical,'threshold_Optical')
  var land_Optical=Optical_img_texture.lt(threshold_Optical)
    .reproject({crs:ndwi_HighMean.projection(),scale:10})
  Map.addLayer(land_Optical,{},'land_Optical',false)
  // print(land_Optical)
  

   
  
//   //*******************Sar Land
  var imgCol_s1 = s1.filterBounds(testarea).filterDate("2022-01-01",'2022-12-31')
  .map(function(image){return image.clip(testarea)})
/**********************VH****************************/
  var SAR_interval_VH=imgCol_s1.select('VH').reduce(ee.Reducer.intervalMean(10,90))
  SAR_interval_VH=SAR_interval_VH.updateMask(SAR_interval_VH.lt(-15)).unmask(-15).clip(testarea)//.multiply(SAR_interval_VH)
  // var imgSAR_VH_Low=display_Percentile.reduce(ee.Reducer.intervalMean(0,10))
  // .convolve(ee.Kernel.gaussian({
  //   radius:1.5,
  // })).clip(testarea)
  Map.addLayer(SAR_interval_VH,{max:-10,min:-30},'sar_VH',false)
  var threshold_Sar=-30
  
 if(Conditions<1)
 {
   
  var Sar_plat=SAR_interval_VH
    var Hist_Sar=Sar_plat.reduceRegion({
        reducer: ee.Reducer.histogram(50)
        .combine('mean', null, true)
        .combine('variance', null, true), 
        geometry:testarea, 
        scale: 30,
        bestEffort: true,
        tileScale:16
        });
  
    threshold_Sar = otsu(Hist_Sar.get("VH_mean_histogram"));
    // print(threshold_Sar,'fomer')
  if( threshold_Sar.getInfo()>-18){
     threshold_Sar=-30
  }
 }
     print( threshold_Sar,"threshold_Sar")
  var land_Sar=SAR_interval_VH
  //.convolve(ee.Kernel.gaussian({radius:2.5,}))
  .gt(threshold_Sar).or(hill_land)
  // .focalMax({radius:15,units:"meters",kernelType:"square"})
  // .focalMin({radius:15,units:"meters",kernelType:"square"})
.reproject({crs:SAR_interval_VH.projection(),scale:10});
  Map.addLayer(land_Sar,{},'land_sar',false)
     
     
/***************************VV******************************/
  var SAR_interval_VV = imgCol_s1.select('VV').reduce(ee.Reducer.intervalMean(0,20))
  var Hist_SarVV = SAR_interval_VV.reduceRegion({
    reducer: ee.Reducer.histogram(50)
    .combine('mean', null, true)
    .combine('variance', null, true), 
    geometry:testarea, 
    scale: 100,
    bestEffort: true,
    tileScale:8
    });
  var threshold_SarVV = otsu(Hist_SarVV.get("VV_mean_histogram"));
  var Land_sarVV=SAR_interval_VV.convolve(ee.Kernel.gaussian({radius:1.5})).gt(threshold_SarVV.getInfo()-2)
    .reproject({crs:ndwi_HighMean.projection(),scale:10})

/************************************************************************/  
//Postprocessing
/************************************************************************/
  
  var Land_patch=land_Optical
  // .focalMax({radius:5,units:"meters",kernelType:"square"})
  //   .focalMin({radius:5,units:"meters",kernelType:"square"})
   .focalMin({radius:25,units:"meters",kernelType:"square"})
  .focalMax({radius:25,units:"meters",kernelType:"square"})
  var Land_line=land_Optical.subtract(Land_patch).gt(0)//.subtract(Noislands)
  .reproject({crs:ndwi_HighMean.projection(),scale:10})
  Map.addLayer(Land_line,{},"Land_line",false)
  
  
  
  var Land_o=land_Optical.and(land_Sar)
  // Result from s1 not s2
   var Land_s1=land_Sar.subtract(land_Optical).gt(0)
   // Result from s2 not s1
  var Land_s2=land_Optical.subtract(land_Sar).gt(0)
  // Map.addLayer(Land_s)
  var VEG1=Land_s1.and(ndvi_mean.gt(0.05)).or(hill_land)
  var VEG2=Land_s2.and(Land_sarVV)
  var Land_Supply_Part=VEG1.or(VEG2)
  .reproject({crs:ndwi_HighMean.projection(),scale:10})
  // var Land_saltmush_Part=Land_s.and(VEG)
  Map.addLayer(Land_Supply_Part,{},'Land_Supply_Part',false)
  
  
  var Land=Land_o.or(Land_Supply_Part).or(Land_line).gt(0)
   .reproject({crs:ndwi_HighMean.projection(),scale:10})
   .select("ndwi_mean").rename("Land")
  //   .focalMax({radius:5,units:"meters",kernelType:"square"})
  // .focalMin({radius:5,units:"meters",kernelType:"square"})

  Map.addLayer(Land,{},"Land",false)
  /************************************************/
  //postprocess step2, using objective oriented methods
  var land_Connect=ndvi_mean.addBands(Land)
  .reduceConnectedComponents({
    reducer:ee.Reducer.mean(),
    labelBand:"Land",
    maxSize:100
  })
  .unmask(1)
  // var landPatches=land_Connect.neq(1)
  var Noislands=land_Connect.lt(0.2)//.or(Land_o.eq(0).and(landPatches))
   .reproject({crs:ndwi_HighMean.projection(),scale:10})
  Map.addLayer(Noislands,{max:1,min:0},"Noislands",false)
  
// var ClosureWater=land_Connect.lt(1).and(Land.lt(1))
// .reproject({crs:ndwi_HighMean.projection(),scale:10})
//   Map.addLayer(ClosureWater,{},'ClosureWater',false)
  var Land_v=Land.subtract(Noislands).gt(0)//.or(ClosureWater)
  .focalMax({radius:10,units:"meters",kernelType:"square"})
  .focalMin({radius:10,units:"meters",kernelType:"square"})
   .reproject({crs:ndwi_HighMean.projection(),scale:10})
  
  //.int8()

  
  
  var land_Connect1=Land_v.addBands(Land_v)
  .reduceConnectedComponents({
    reducer:ee.Reducer.sum(),
    labelBand:"Land",
    maxSize:100
  })
  .unmask(101)
  
  // var OceanNoise=land_Connect1.lt(101).and(Land_v)
  var Landwater=land_Connect1.lt(101).and(Land_v.lt(1))
  
  var Land_v1=Land_v.or(Landwater).gt(0)//.subtract(OceanNoise).gt(0)
   .reproject({crs:ndwi_HighMean.projection(),scale:10})
  Map.addLayer(Land_v1,{},'Land_v1',false)
  // var LandScope=Land_v1.convolve(ee.Kernel.laplacian8({normalize:true})).lt(-0.1)//.add(SandCage).gt(0)
  // //.convolve(ee.Kernel.laplacian8({normalize:true})).lt(-0.1)
  // .reproject({crs:ndwi_HighMean.projection(),scale:3.333})
  // Map.addLayer(LandScope,{},'LandScope',false)
  // var ExportBinaryImage=Land_v1.byte()
  // Export.image.toDrive({
  //   image:ExportBinaryImage,
  //   description:"test"+selector.getValue(),
  //   folder:'Coastline',
  //   fileNamePrefix:'ExtractionTest_'+selector.getValue()+Textbox.getValue(),
  //   region:testarea,
  //   scale:10,
  //   maxPixels:1e13,
  //   skipEmptyTiles:true,
  // })

 
}


function maskS2clouds(image) {
  var qa = image.select('QA60')

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0))

  // Return the masked and scaled data, without the QA bands.
  return image.updateMask(mask)//.divide(10000)
      .select("B.*")
      .copyProperties(image, ["system:time_start"])
}



function maskL8sr(image) {
  // Bit 0 - Fill
  // Bit 1 - Dilated Cloud
  // Bit 2 - Cirrus
  // Bit 3 - Cloud
  // Bit 4 - Cloud Shadow
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);

  // Apply the scaling factors to the appropriate bands.
  var opticalBands = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  var thermalBands = image.select('ST_B.*').multiply(0.00341802).add(149.0);

  // Replace the original bands with the scaled ones and apply the masks.
  return image.addBands(opticalBands, null, true)
      .addBands(thermalBands, null, true)
      .updateMask(qaMask)
      .updateMask(saturationMask);
}

 function otsu(histogram) {
  var counts = ee.Array(ee.Dictionary(histogram).get('histogram'));
  var means = ee.Array(ee.Dictionary(histogram).get('bucketMeans'));
  var size = means.length().get([0]);
  var total = counts.reduce(ee.Reducer.sum(), [0]).get([0]);
  var sum = means.multiply(counts).reduce(ee.Reducer.sum(), [0]).get([0]);
  var mean = sum.divide(total);
  
  var indices = ee.List.sequence(1, size);
  
  // Compute between sum of squares, where each mean partitions the data.
  var bss = indices.map(function(i) {
    var aCounts = counts.slice(0, 0, i);
    var aCount = aCounts.reduce(ee.Reducer.sum(), [0]).get([0]);
    var aMeans = means.slice(0, 0, i);
    var aMean = aMeans.multiply(aCounts)
        .reduce(ee.Reducer.sum(), [0]).get([0])
        .divide(aCount);
    var bCount = total.subtract(aCount);
    var bMean = sum.subtract(aCount.multiply(aMean)).divide(bCount);
    return aCount.multiply(aMean.subtract(mean).pow(2)).add(
          bCount.multiply(bMean.subtract(mean).pow(2)));
  });
  
  //print(ui.Chart.array.values(ee.Array(bss), 0, means));
  
  // Return the mean value corresponding to the maximum BSS.
  return (means.sort(bss).get([-1]));
}
