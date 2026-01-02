class User {
  final String id;
  final String email;
  final String plan;
  final int videosThisMonth;
  final int schedulersCount;
  final String? sunoApiKey;
  final String? youtubeRefreshToken;

  User({
    required this.id,
    required this.email,
    required this.plan,
    this.videosThisMonth = 0,
    this.schedulersCount = 0,
    this.sunoApiKey,
    this.youtubeRefreshToken,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      plan: json['plan'] as String? ?? 'free',
      videosThisMonth: json['videosThisMonth'] as int? ?? 0,
      schedulersCount: json['schedulersCount'] as int? ?? 0,
      sunoApiKey: json['sunoApiKey'] as String?,
      youtubeRefreshToken: json['youtubeRefreshToken'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'plan': plan,
      'videosThisMonth': videosThisMonth,
      'schedulersCount': schedulersCount,
      'sunoApiKey': sunoApiKey,
      'youtubeRefreshToken': youtubeRefreshToken,
    };
  }

  bool get isPro => plan == 'pro';
  bool get isFree => plan == 'free';
  bool get requiresSunoKey => isFree && (sunoApiKey == null || sunoApiKey!.isEmpty);
}

class YouTubeChannel {
  final String id;
  final String title;
  final String description;
  final String thumbnailUrl;
  final String subscriberCount;
  final String videoCount;

  YouTubeChannel({
    required this.id,
    required this.title,
    required this.description,
    required this.thumbnailUrl,
    required this.subscriberCount,
    required this.videoCount,
  });

  factory YouTubeChannel.fromJson(Map<String, dynamic> json) {
    return YouTubeChannel(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String? ?? '',
      thumbnailUrl: json['thumbnailUrl'] as String,
      subscriberCount: json['subscriberCount'] as String? ?? '0',
      videoCount: json['videoCount'] as String? ?? '0',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'thumbnailUrl': thumbnailUrl,
      'subscriberCount': subscriberCount,
      'videoCount': videoCount,
    };
  }
}
