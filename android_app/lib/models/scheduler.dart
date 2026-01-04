class Scheduler {
  final String id;
  final String name;
  final String userId;
  final String channelId;
  
  // Immutable fields
  final String time;  // HH:MM format
  final String frequency;  // daily/weekly/monthly
  final List<int> activeDays;  // [0-6] for weekly
  final String language;
  
  // Editable fields
  final List<String> genres;
  final String titlePrompt;
  final String descPrompt;
  final String tagsPrompt;
  final String lyricsPrompt;
  
  final bool active;
  final String? error;
  final DateTime? nextRunAt;
  final DateTime createdAt;

  Scheduler({
    required this.id,
    required this.name,
    required this.userId,
    required this.channelId,
    required this.time,
    required this.frequency,
    required this.activeDays,
    required this.language,
    required this.genres,
    this.titlePrompt = '',
    this.descPrompt = '',
    this.tagsPrompt = '',
    this.lyricsPrompt = '',
    this.active = true,
    this.error,
    this.nextRunAt,
    required this.createdAt,
  });

  factory Scheduler.fromJson(Map<String, dynamic> json) {
    return Scheduler(
      id: json['id'] as String,
      name: json['name'] as String,
      userId: json['userId'] as String,
      channelId: json['channelId'] as String,
      time: json['time'] as String,
      frequency: json['frequency'] as String,
      activeDays: (json['activeDays'] as List? ?? []).cast<int>(),
      language: json['language'] as String,
      genres: (json['genres'] as List).cast<String>(),
      titlePrompt: json['titlePrompt'] as String? ?? '',
      descPrompt: json['descPrompt'] as String? ?? '',
      tagsPrompt: json['tagsPrompt'] as String? ?? '',
      lyricsPrompt: json['lyricsPrompt'] as String? ?? '',
      active: json['active'] as bool? ?? true,
      error: json['error'] as String?,
      nextRunAt: json['nextRunAt'] != null 
          ? DateTime.parse(json['nextRunAt'] as String)
          : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'channelId': channelId,
      'time': time,
      'frequency': frequency,
      'activeDays': activeDays,
      'language': language,
      'genres': genres,
      'titlePrompt': titlePrompt,
      'descPrompt': descPrompt,
      'tagsPrompt': tagsPrompt,
      'lyricsPrompt': lyricsPrompt,
    };
  }

  String get frequencyDisplay {
    switch (frequency) {
      case 'daily':
        return 'Daily at $time';
      case 'weekly':
        final days = activeDays.map((d) => _dayName(d)).join(', ');
        return 'Weekly on $days at $time';
      case 'monthly':
        return 'Monthly at $time';
      default:
        return frequency;
    }
  }

  String _dayName(int day) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day % 7];
  }
}
