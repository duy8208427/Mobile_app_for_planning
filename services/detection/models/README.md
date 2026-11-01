Place `yolo11-seg-buildings.onnx` here.

Export from Ultralytics:

```
pip install ultralytics
yolo export model=yolo11n-seg.pt format=onnx
copy yolo11n-seg.onnx services/detection/models/yolo11-seg-buildings.onnx
```

The same ONNX file can be loaded in QGIS Deepness. Without the file, `python -m detection run --mock` still runs overlay on synthetic footprints so GIS rules can be tested.
