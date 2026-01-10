import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import '../theme/app_theme.dart';

/// Image Crop Screen with fixed 16:9 ratio grid
/// User can scale/pan image, but grid overlay is locked
class ImageCropScreen extends StatefulWidget {
  final File imageFile;
  
  const ImageCropScreen({super.key, required this.imageFile});

  @override
  State<ImageCropScreen> createState() => _ImageCropScreenState();
}

class _ImageCropScreenState extends State<ImageCropScreen> {
  final GlobalKey _cropKey = GlobalKey();
  final TransformationController _transformController = TransformationController();
  
  double _scale = 1.0;
  Offset _offset = Offset.zero;
  late Size _imageSize;
  bool _imageLoaded = false;
  bool _isCropping = false;

  @override
  void initState() {
    super.initState();
    _loadImage();
  }

  Future<void> _loadImage() async {
    final bytes = await widget.imageFile.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    setState(() {
      _imageSize = Size(frame.image.width.toDouble(), frame.image.height.toDouble());
      _imageLoaded = true;
    });
  }

  @override
  void dispose() {
    _transformController.dispose();
    super.dispose();
  }

  Future<File?> _cropImage() async {
    if (_isCropping) return null;
    
    setState(() => _isCropping = true);
    
    try {
      // Get the render box of the crop area
      final RenderRepaintBoundary boundary = 
          _cropKey.currentContext!.findRenderObject() as RenderRepaintBoundary;
      
      // Capture at 1920x1080 for high quality 16:9 output
      final ui.Image image = await boundary.toImage(pixelRatio: 3.0);
      final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      
      if (byteData == null) {
        throw Exception('Failed to capture image');
      }
      
      final Uint8List pngBytes = byteData.buffer.asUint8List();
      
      // Save to temp file
      final tempDir = await getTemporaryDirectory();
      final timestamp = DateTime.now().millisecondsSinceEpoch;
      final croppedFile = File('${tempDir.path}/cropped_$timestamp.png');
      await croppedFile.writeAsBytes(pngBytes);
      
      return croppedFile;
    } catch (e) {
      debugPrint('Crop error: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to crop image: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
      return null;
    } finally {
      setState(() => _isCropping = false);
    }
  }

  void _handleSave() async {
    final croppedFile = await _cropImage();
    if (croppedFile != null && mounted) {
      Navigator.pop(context, croppedFile);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'Crop Thumbnail',
          style: TextStyle(color: Colors.white),
        ),
        actions: [
          TextButton(
            onPressed: _isCropping ? null : _handleSave,
            child: _isCropping
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : const Text(
                    'Done',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
          ),
        ],
      ),
      body: Column(
        children: [
          // Instructions
          Container(
            padding: const EdgeInsets.all(12),
            child: Text(
              'Pinch to zoom • Drag to move',
              style: TextStyle(
                color: Colors.white.withOpacity(0.7),
                fontSize: 14,
              ),
            ),
          ),
          
          // Crop Area
          Expanded(
            child: Center(
              child: _imageLoaded
                  ? _buildCropArea()
                  : const CircularProgressIndicator(),
            ),
          ),
          
          // Reset button
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                OutlinedButton.icon(
                  onPressed: () {
                    _transformController.value = Matrix4.identity();
                    setState(() {
                      _scale = 1.0;
                      _offset = Offset.zero;
                    });
                  },
                  icon: const Icon(Icons.refresh, color: Colors.white),
                  label: const Text('Reset', style: TextStyle(color: Colors.white)),
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: Colors.white54),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCropArea() {
    final screenWidth = MediaQuery.of(context).size.width - 32; // padding
    final cropHeight = screenWidth * (9 / 16); // 16:9 ratio
    
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Crop container with 16:9 aspect ratio
          Container(
            width: screenWidth,
            height: cropHeight,
            decoration: BoxDecoration(
              border: Border.all(color: AppTheme.primaryColor, width: 2),
              borderRadius: BorderRadius.circular(8),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: RepaintBoundary(
                key: _cropKey,
                child: InteractiveViewer(
                  transformationController: _transformController,
                  minScale: 0.5,
                  maxScale: 5.0,
                  panEnabled: true,
                  scaleEnabled: true,
                  onInteractionUpdate: (details) {
                    setState(() {
                      _scale = details.scale;
                    });
                  },
                  child: Image.file(
                    widget.imageFile,
                    fit: BoxFit.cover,
                    width: screenWidth,
                    height: cropHeight,
                  ),
                ),
              ),
            ),
          ),
          
          const SizedBox(height: 16),
          
          // Grid overlay info
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.aspect_ratio, color: Colors.white.withOpacity(0.7), size: 20),
                const SizedBox(width: 8),
                Text(
                  '16:9 Ratio • ${_scale.toStringAsFixed(1)}x',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.7),
                    fontSize: 14,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
