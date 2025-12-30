class Video {
  final String id;
  final String schedulerId;
  final String userId;
  final String channelId;
  
  final String title;
  final String description;
  final List<String> tags;
  final String lyrics;
  final List<String> genres;
  
  final String? audioUrl;
  final String? thumbnailUrl;
  final String? youtubeId;
  final DateTime? scheduledPublishAt;
  
  final String status;  // queued/processing/ready/uploading/uploaded/failed
  final String? error;
  final bool locked;
  
  final DateTime createdAt;
  final DateTime? uploadedAt;

  Video({
    required this.id,
    required this.schedulerId,
    required this.userId,
    required this.channelId,
    required this.title,
    required this.description,
    required this.tags,
    required this.lyrics,
    required this.genres,
    this.audioUrl,
    this.thumbnailUrl,
    this.youtubeId,
    this.scheduledPublishAt,
    required this.status,
    this.error,
    this.locked = false,
    required this.createdAt,
    this.uploadedAt,
  });

  factory Video.fromJson(Map<String, dynamic> json) {
    return Video(
      id: json['id'] as String,
      schedulerId: json['schedulerId'] as String,
      userId: json['userId'] as String,
      channelId: json['channelId'] as String,
      title: json['title'] as String,
      description: json['description'] as String,
      tags: (json['tags'] as List).cast<String>(),
      lyrics: json['lyrics'] as String? ?? '',
      genres: (json['genres'] as List).cast<String>(),
      audioUrl: json['audioUrl'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      youtubeId: json['youtubeId'] as String?,
      scheduledPublishAt: json['scheduledPublishAt'] != null
          ? DateTime.parse(json['scheduledPublishAt'] as String)
          : null,
      status: json['status'] as String,
      error: json['error'] as String?,
      locked: json['locked'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      uploadedAt: json['uploadedAt'] != null
          ? DateTime.parse(json['uploadedAt'] as String)
          : null,
    );
  }

  bool get isEditable => !locked && status != 'uploaded';
  bool get isUploaded => status == 'uploaded';
  bool get isProcessing => status == 'processing';
  bool get isReady => status == 'ready';
  bool get isFailed => status == 'failed';
  bool get isQueued => status == 'queued';

  String get statusDisplay {
    switch (status) {
      case 'queued':
        return 'Queued';
      case 'processing':
        return 'Processing';
      case 'ready':
        return 'Ready';
      case 'uploading':
        return 'Uploading';
      case 'uploaded':
        return 'Uploaded';
      case 'failed':
        return 'Failed';
      default:
        return status;
    }
  }

  String? get youtubeUrl => youtubeId != null 
      ? 'https://www.youtube.com/watch?v=$youtubeId'
      : null;
}
