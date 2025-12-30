const String baseUrl = 'https://jusdown.onrender.com/api';

class ApiConstants {
  // Auth endpoints
  static const String authYoutube = '/auth/youtube';
  static const String authCallback = '/auth/callback';
  static const String authRefresh = '/auth/refresh';
  static const String authChannels = '/auth/channels';
  static const String authSignout = '/auth/signout';

  // Scheduler endpoints
  static const String schedulers = '/schedulers';
  static String schedulerById(String id) => '/schedulers/$id';
  static String schedulerToggle(String id) => '/schedulers/$id/toggle';

  // Video endpoints
  static const String videos = '/videos';
  static String videoById(String id) => '/videos/$id';
  static String videoThumbnail(String id) => '/videos/$id/thumbnail';
  static String videoUploadNow(String id) => '/videos/$id/upload-now';

  // Settings endpoints
  static const String settings = '/settings';
  static const String settingsSunoKey = '/settings/suno-key';
  static const String settingsQuota = '/settings/quota';
  static const String settingsUpgrade = '/settings/upgrade';

  // Webhooks
  static const String webhookVideoDeleted = '/webhooks/video-deleted';
}
