import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:device_info_plus/device_info_plus.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../models/video.dart';
import '../services/api_service.dart';

class SongDetailScreen extends StatefulWidget {
  const SongDetailScreen({super.key});

  @override
  State<SongDetailScreen> createState() => _SongDetailScreenState();
}

class _SongDetailScreenState extends State<SongDetailScreen> {
  Timer? _pollingTimer;
  Video? _video;
  bool _isLoading = true;
  bool _isUploading = false;
  bool _isUploadingThumbnail = false;
  
  // Video Player
  VideoPlayerController? _videoController;
  bool _isVideoInitialized = false;
  bool _isPlaying = false;
  
  // YouTube Player (WebView)
  WebViewController? _webViewController;
  bool _isYouTubeInitialized = false;
  
  // Validation
  bool _titleError = false;
  bool _descError = false;
  bool _tagsError = false;
  
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _tagsController = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final videoId = ModalRoute.of(context)!.settings.arguments as String;
    if (_video == null) {
      _loadVideo(videoId);
    }
  }

  Future<void> _loadVideo(String id) async {
    // Only show loader initially, not on poll updates
    if (_video == null) {
      setState(() => _isLoading = true);
    }
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      
      // IMPORTANT: Call API directly to get fresh data including YouTube metadata
      // For uploaded videos, backend fetches live title/description/tags from YouTube
      Video updatedVideo;
      try {
        final api = ApiService();
        updatedVideo = await api.getVideo(id);
        debugPrint('[SongDetail] Fetched video from API: ${updatedVideo.title}');
      } catch (e) {
        debugPrint('[SongDetail] API fetch failed, falling back to cache: $e');
        // Fallback to cached list if API fails
        updatedVideo = appState.videos.firstWhere((v) => v.id == id);
      }
      
      if (mounted) {
        setState(() {
          _video = updatedVideo;
          // Update fields only if they are empty or unedited to avoid overwriting user input
          if (_titleController.text.isEmpty && updatedVideo.title != 'Untitled Video') {
             _titleController.text = updatedVideo.title;
          }
          if (_descController.text.isEmpty && updatedVideo.description != 'No description available.') {
             _descController.text = updatedVideo.description;
          }
          if (_tagsController.text.isEmpty && updatedVideo.tags.isNotEmpty) {
             _tagsController.text = updatedVideo.tags.join(', ');
          }
        });

        // Start polling if processing, init video player if ready or uploaded
        if (_video!.status == 'processing') {
          _startPolling(id);
        } else {
          _stopPolling();
          // Initialize video player for ready (local) or uploaded (YouTube) videos
          if ((_video!.status == 'ready' && _videoController == null) ||
              (_video!.status == 'uploaded' && _video!.youtubeId != null && !_isYouTubeInitialized)) {
            _initVideoPlayer();
          }
        }
      }
    } catch (e) {
      debugPrint('Error loading video: $e');
      if (mounted && _video == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading video: $e')),
        );
      }
    } finally {
      if (mounted && _isLoading) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _startPolling(String id) {
    if (_pollingTimer != null && _pollingTimer!.isActive) return;
    
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      _loadVideo(id);
    });
  }

  void _stopPolling() {
    _pollingTimer?.cancel();
    _pollingTimer = null;
  }


  Future<void> _saveChanges() async {
    if (!_video!.isEditable) return;
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      
      await appState.updateVideo(_video!.id, {
        'title': _titleController.text,
        'description': _descController.text,
        'tags': _tagsController.text.split(',').map((t) => t.trim()).toList(),
      });
      
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Video updated successfully'),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to update video: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    }
  }

  Future<void> _uploadNow() async {
    if (!_video!.isReady) return;
    
    // Validate fields before upload
    if (!_validateFields()) return;
    
    setState(() => _isUploading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.uploadVideoNow(_video!.id);
      
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Video uploaded successfully!'),
          backgroundColor: AppTheme.success,
        ),
      );
      
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Upload failed: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isUploading = false);
      }
    }
  }

  Future<void> _deleteVideo() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Video?'),
        content: const Text('This will trigger generation of a replacement video for this scheduler.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.deleteVideo(_video!.id, _video!.schedulerId);
      
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Video deleted. Replacement will be generated.'),
          backgroundColor: AppTheme.info,
        ),
      );
      
      Navigator.pop(context);
    }
  }

  /// Download audio file to device Downloads folder
  Future<void> _downloadAudio() async {
    if (_video?.audioUrl == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No audio URL available')),
      );
      return;
    }

    // Request storage permission based on Android version
    bool permissionGranted = false;
    
    // Check Android version and request appropriate permission
    if (Platform.isAndroid) {
      final androidInfo = await DeviceInfoPlugin().androidInfo;
      final sdkInt = androidInfo.version.sdkInt;
      
      debugPrint('[Download] Android SDK: $sdkInt');
      
      if (sdkInt >= 33) {
        // Android 13+ (API 33+): Use READ_MEDIA_AUDIO
        var status = await Permission.audio.status;
        debugPrint('[Download] Audio permission status: $status');
        
        if (!status.isGranted) {
          status = await Permission.audio.request();
          debugPrint('[Download] Audio permission after request: $status');
        }
        permissionGranted = status.isGranted;
        
      } else if (sdkInt >= 30) {
        // Android 11-12 (API 30-32): Use MANAGE_EXTERNAL_STORAGE or storage
        var status = await Permission.manageExternalStorage.status;
        debugPrint('[Download] ManageStorage status: $status');
        
        if (!status.isGranted) {
          status = await Permission.manageExternalStorage.request();
        }
        permissionGranted = status.isGranted;
        
        // Fallback to storage permission
        if (!permissionGranted) {
          status = await Permission.storage.request();
          permissionGranted = status.isGranted;
        }
        
      } else {
        // Android 10 and below: Use storage permission
        var status = await Permission.storage.status;
        debugPrint('[Download] Storage status: $status');
        
        if (!status.isGranted) {
          status = await Permission.storage.request();
          debugPrint('[Download] Storage after request: $status');
        }
        permissionGranted = status.isGranted;
      }
    } else {
      // iOS or other platforms
      permissionGranted = true;
    }
    
    // If permission denied, show dialog to open settings
    if (!permissionGranted && mounted) {
      debugPrint('[Download] Permission denied, showing settings dialog');
      final openSettings = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Storage Permission Required'),
          content: const Text(
            'To download audio files, please grant storage/media permission in Settings.\n\n'
            'Go to Settings → Permissions → Storage/Files and allow access.',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Open Settings'),
            ),
          ],
        ),
      );
      
      if (openSettings == true) {
        await openAppSettings();
      }
      return;
    }

    // Show download started
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Downloading audio...')),
      );
    }

    try {
      final dio = Dio();
      
      // Get Downloads directory
      Directory? downloadsDir;
      if (Platform.isAndroid) {
        downloadsDir = Directory('/storage/emulated/0/Download');
      } else {
        downloadsDir = await getApplicationDocumentsDirectory();
      }

      // Create filename from title
      final safeTitle = (_video!.title)
          .replaceAll(RegExp(r'[^\w\s-]'), '')
          .replaceAll(' ', '_')
          .substring(0, _video!.title.length > 50 ? 50 : _video!.title.length);
      final filename = '${safeTitle}_${_video!.id}.mp3';
      final savePath = '${downloadsDir.path}/$filename';

      await dio.download(
        _video!.audioUrl!,
        savePath,
        onReceiveProgress: (received, total) {
          if (total != -1) {
            debugPrint('Download progress: ${(received / total * 100).toStringAsFixed(0)}%');
          }
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Audio saved to: $filename'),
            backgroundColor: AppTheme.success,
            duration: const Duration(seconds: 3),
          ),
        );
      }
    } catch (e) {
      debugPrint('Download error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: ${e.toString()}'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _videoController?.dispose();
    _titleController.dispose();
    _descController.dispose();
    _tagsController.dispose();
    super.dispose();
  }

  void _initVideoPlayer() {
    if (_video == null) return;
    
    // Case 1: Uploaded to YouTube -> Use WebView
    if (_video!.status == 'uploaded' && _video!.youtubeId != null) {
      final youtubeUrl = 'https://www.youtube.com/embed/${_video!.youtubeId}?autoplay=0&rel=0';
      
      _webViewController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0x00000000))
        ..setNavigationDelegate(
          NavigationDelegate(
            onNavigationRequest: (request) {
              return NavigationDecision.navigate;
            },
          ),
        )
        ..loadRequest(Uri.parse(youtubeUrl));
        
      if (mounted) {
        setState(() => _isYouTubeInitialized = true);
      }
      return;
    }
    
    // Case 2: Ready (Local) -> Use VideoPlayer
    if (_video!.status == 'ready') {
      final baseUrl = ApiService.apiBaseUrl;
      final videoUrl = '$baseUrl/videos/${_video!.id}/stream';
      
      _videoController = VideoPlayerController.networkUrl(Uri.parse(videoUrl))
        ..initialize().then((_) {
          if (mounted) {
            setState(() => _isVideoInitialized = true);
          }
        }).catchError((e) {
          debugPrint('Error initializing video player: $e');
        });
      
      _videoController!.addListener(() {
        if (mounted) {
          setState(() => _isPlaying = _videoController!.value.isPlaying);
        }
      });
    }
  }

  Future<void> _togglePlayPause() async {
    if (_videoController == null || !_isVideoInitialized) return;
    
    if (_isPlaying) {
      await _videoController!.pause();
    } else {
      await _videoController!.play();
    }
  }

  Future<void> _pickAndUploadThumbnail() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1280, maxHeight: 720);
    
    if (image == null) return;
    
    setState(() => _isUploadingThumbnail = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.uploadThumbnail(_video!.id, image.path);
      
      // Reload video to get new thumbnail URL
      await _loadVideo(_video!.id);
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Thumbnail updated!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload thumbnail: $e'), backgroundColor: AppTheme.error),
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingThumbnail = false);
    }
  }

  bool _validateFields() {
    setState(() {
      _titleError = _titleController.text.trim().isEmpty;
      _descError = _descController.text.trim().isEmpty;
      _tagsError = _tagsController.text.trim().isEmpty;
    });
    
    if (_titleError || _descError || _tagsError) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('⚠️ Please fill in all required fields'),
          backgroundColor: AppTheme.error,
        ),
      );
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _video == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back),
                    style: IconButton.styleFrom(
                      backgroundColor: AppTheme.surfaceDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      _video!.locked ? 'Video Details' : 'Review Video',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  if (_video!.isEditable)
                    PopupMenuButton(
                      itemBuilder: (context) => [
                        // Download Audio Option
                        if (_video!.audioUrl != null)
                          PopupMenuItem(
                            onTap: _downloadAudio,
                            child: const Row(
                              children: [
                                Icon(Icons.download, color: AppTheme.primaryColor),
                                SizedBox(width: 8),
                                Text('Download Audio'),
                              ],
                            ),
                          ),
                        PopupMenuItem(
                          onTap: _deleteVideo,
                          child: const Row(
                            children: [
                              Icon(Icons.delete, color: AppTheme.error),
                              SizedBox(width: 8),
                              Text('Delete Video'),
                            ],
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
            
            // Content
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Video Player with Thumbnail Edit Button (no separate thumbnail preview)
                    if (_video!.status == 'ready' || _video!.status == 'uploaded')
                      Container(
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Column(
                          children: [
                            // Video Preview
                            ClipRRect(
                              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                              child: AspectRatio(
                                aspectRatio: 16 / 9,
                                child: _video!.status == 'uploaded' 
                                  // YouTube Player (WebView)
                                  ? (_isYouTubeInitialized && _webViewController != null
                                      ? WebViewWidget(controller: _webViewController!)
                                      : const Center(child: CircularProgressIndicator()))
                                  // Local Player
                                  : (_isVideoInitialized && _videoController != null
                                      ? Stack(
                                          alignment: Alignment.center,
                                          children: [
                                            VideoPlayer(_videoController!),
                                            // Play/Pause Overlay
                                            GestureDetector(
                                              onTap: _togglePlayPause,
                                              child: Container(
                                                color: Colors.transparent,
                                                child: AnimatedOpacity(
                                                  opacity: _isPlaying ? 0.0 : 1.0,
                                                  duration: const Duration(milliseconds: 300),
                                                  child: Container(
                                                    padding: const EdgeInsets.all(16),
                                                    decoration: BoxDecoration(
                                                      color: Colors.black.withOpacity(0.5),
                                                      shape: BoxShape.circle,
                                                    ),
                                                    child: const Icon(Icons.play_arrow, size: 48, color: Colors.white),
                                                  ),
                                                ),
                                              ),
                                            ),
                                            // Thumbnail Edit Icon (top right)
                                            if (_video!.isEditable)
                                              Positioned(
                                                top: 8,
                                                right: 8,
                                                child: GestureDetector(
                                                  onTap: _isUploadingThumbnail ? null : _pickAndUploadThumbnail,
                                                  child: Container(
                                                    padding: const EdgeInsets.all(8),
                                                    decoration: BoxDecoration(
                                                      color: Colors.black.withOpacity(0.6),
                                                      shape: BoxShape.circle,
                                                    ),
                                                    child: _isUploadingThumbnail
                                                        ? const SizedBox(
                                                            width: 16,
                                                            height: 16,
                                                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                                          )
                                                        : const Icon(Icons.edit, size: 16, color: Colors.white),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        )
                                      : const Center(
                                          child: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              CircularProgressIndicator(),
                                              SizedBox(height: 12),
                                              Text('Loading video...'),
                                            ],
                                          ),
                                        )),
                              ),
                            ),
                            // Video Controls
                            if (_isVideoInitialized && _videoController != null)
                              Padding(
                                padding: const EdgeInsets.all(12),
                                child: Row(
                                  children: [
                                    IconButton(
                                      onPressed: _togglePlayPause,
                                      icon: Icon(
                                        _isPlaying ? Icons.pause : Icons.play_arrow,
                                        color: AppTheme.primaryColor,
                                      ),
                                    ),
                                    Expanded(
                                      child: VideoProgressIndicator(
                                        _videoController!,
                                        allowScrubbing: true,
                                        colors: VideoProgressColors(
                                          playedColor: AppTheme.primaryColor,
                                          bufferedColor: AppTheme.primaryColor.withOpacity(0.3),
                                          backgroundColor: AppTheme.surfaceHighlight,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ValueListenableBuilder(
                                      valueListenable: _videoController!,
                                      builder: (context, VideoPlayerValue value, child) {
                                        final position = value.position;
                                        final duration = value.duration;
                                        return Text(
                                          '${position.inMinutes}:${(position.inSeconds % 60).toString().padLeft(2, '0')} / ${duration.inMinutes}:${(duration.inSeconds % 60).toString().padLeft(2, '0')}',
                                          style: Theme.of(context).textTheme.bodySmall,
                                        );
                                      },
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      )
                    else if (_video!.status == 'processing')
                      Container(
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Column(
                          children: [
                            CircularProgressIndicator(),
                            SizedBox(height: 16),
                            Text('Generating video...', style: TextStyle(fontWeight: FontWeight.w500)),
                            SizedBox(height: 4),
                            Text('Creating audio, thumbnail, and merging...', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                          ],
                        ),
                      ),
                    
                    const SizedBox(height: 20),
                    
                    // Status
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: _getStatusColor(_video!.status).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: _getStatusColor(_video!.status).withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _getStatusIcon(_video!.status),
                            color: _getStatusColor(_video!.status),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _video!.statusDisplay,
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    color: _getStatusColor(_video!.status),
                                  ),
                                ),
                                if (_video!.scheduledPublishAt != null)
                                  Text(
                                    'Scheduled: ${DateFormat('MMM d, h:mm a').format(_video!.scheduledPublishAt!)}',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: _getStatusColor(_video!.status),
                                    ),
                                  ),
                              ],
                            ),
                          ),
                          if (_video!.locked)
                            const Icon(Icons.lock, color: AppTheme.warning),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Title
                    Text(
                      'Title *',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: _titleError ? AppTheme.error : null,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _titleController,
                      enabled: _video!.isEditable,
                      maxLength: 100,
                      onChanged: (_) => setState(() => _titleError = false),
                      decoration: InputDecoration(
                        hintText: 'Video title',
                        counterText: _video!.isEditable ? null : '',
                        errorText: _titleError ? 'Title is required' : null,
                        enabledBorder: _titleError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                        focusedBorder: _titleError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                      ),
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Description
                    Text(
                      'Description *',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: _descError ? AppTheme.error : null,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _descController,
                      enabled: _video!.isEditable,
                      maxLines: 5,
                      maxLength: 5000,
                      onChanged: (_) => setState(() => _descError = false),
                      decoration: InputDecoration(
                        hintText: 'Video description',
                        errorText: _descError ? 'Description is required' : null,
                        enabledBorder: _descError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                        focusedBorder: _descError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                      ),
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Tags
                    Text(
                      'Tags (comma-separated) *',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        color: _tagsError ? AppTheme.error : null,
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _tagsController,
                      enabled: _video!.isEditable,
                      onChanged: (_) => setState(() => _tagsError = false),
                      decoration: InputDecoration(
                        hintText: 'tag1, tag2, tag3',
                        helperText: 'Maximum 15 tags',
                        errorText: _tagsError ? 'At least one tag is required' : null,
                        enabledBorder: _tagsError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                        focusedBorder: _tagsError ? OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: const BorderSide(color: AppTheme.error, width: 2),
                        ) : null,
                      ),
                    ),
                    
                    const SizedBox(height: 20),
                    
                    // Genres (read-only)
                    Text(
                      'Genres',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 6,
                      runSpacing: 6,
                      children: _video!.genres.map((genre) {
                        return Chip(
                          label: Text(genre),
                          backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                        );
                      }).toList(),
                    ),
                    
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      
      // Action buttons
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          border: Border(
            top: BorderSide(
              color: Colors.white.withOpacity(0.05),
            ),
          ),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_video!.isEditable) ...[
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _saveChanges,
                    child: const Text('Save Changes'),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (_video!.isReady)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _isUploading ? null : _uploadNow,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.success,
                    ),
                    child: _isUploading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                            ),
                          )
                        : const Text('Upload to YouTube Now'),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'ready':
        return AppTheme.success;
      case 'processing':
        return AppTheme.info;
      case 'failed':
        return AppTheme.error;
      case 'uploaded':
        return AppTheme.primaryColor;
      default:
        return AppTheme.textSecondary;
    }
  }

  IconData _getStatusIcon(String status) {
    switch (status) {
      case 'ready':
        return Icons.check_circle;
      case 'processing':
        return Icons.hourglass_empty;
      case 'failed':
        return Icons.error;
      case 'uploaded':
        return Icons.cloud_done;
      default:
        return Icons.circle;
    }
  }
}
