import 'dart:io';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../models/scheduler.dart';
import '../models/video.dart';
import 'api_constants.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late Dio _dio;
  final _storage = const FlutterSecureStorage();

  // Expose baseUrl for video streaming URL construction (uses api_constants.dart)
  static String get apiBaseUrl => baseUrl;

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,  // From api_constants.dart: https://jusdown.onrender.com/api
      connectTimeout: const Duration(seconds: 30),
      receiveTimeout: const Duration(seconds: 30),
      headers: {
        'Content-Type': 'application/json',
      },
    ));

    // Add interceptors for logging and token refresh
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Add access token to all requests
        final accessToken = await _storage.read(key: 'access_token');
        if (accessToken != null) {
          options.queryParameters['accessToken'] = accessToken;
        }
        print('[API] ${options.method} ${options.path}');
        return handler.next(options);
      },
      onResponse: (response, handler) {
        print('[API] Response: ${response.statusCode}');
        return handler.next(response);
      },
      onError: (error, handler) async {
        print('[API] Error: ${error.message}');
        
        // Handle 401 - refresh token
        if (error.response?.statusCode == 401) {
          final refreshToken = await _storage.read(key: 'refresh_token');
          if (refreshToken != null) {
            try {
              final newToken = await refreshAccessToken(refreshToken);
              // Retry original request with new token
              error.requestOptions.queryParameters['accessToken'] = newToken;
              final response = await _dio.fetch(error.requestOptions);
              return handler.resolve(response);
            } catch (e) {
              // Refresh failed, user needs to re-login
              await clearTokens();
            }
          }
        }
        
        return handler.next(error);
      },
    ));
  }

  // ==================== AUTH ====================

  Future<String> getYouTubeAuthUrl() async {
    final response = await _dio.get(ApiConstants.authYoutube);
    return response.data['authUrl'] as String;
  }

  Future<Map<String, dynamic>> handleOAuthCallback(String code) async {
    final response = await _dio.get(
      ApiConstants.authCallback,
      queryParameters: {'code': code},
    );

    final data = response.data as Map<String, dynamic>;
    
    // Store tokens
    await _storage.write(
      key: 'access_token',
      value: data['tokens']['accessToken'] as String,
    );
    await _storage.write(
      key: 'refresh_token',
      value: data['tokens']['refreshToken'] as String,
    );
    
    return data;
  }

  Future<String> refreshAccessToken(String refreshToken) async {
    final response = await _dio.post(
      ApiConstants.authRefresh,
      data: {'refreshToken': refreshToken},
    );
    
    final accessToken = response.data['accessToken'] as String;
    await _storage.write(key: 'access_token', value: accessToken);
    
    return accessToken;
  }

  Future<List<YouTubeChannel>> getChannels() async {
    final response = await _dio.get(ApiConstants.authChannels);
    final channels = (response.data['channels'] as List)
        .map((json) => YouTubeChannel.fromJson(json))
        .toList();
    return channels;
  }

  Future<void> signOut() async {
    await _dio.post(ApiConstants.authSignout);
    await clearTokens();
  }

  Future<void> clearTokens() async {
    await _storage.delete(key: 'access_token');
    await _storage.delete(key: 'refresh_token');
  }

  // ==================== SCHEDULERS ====================

  Future<List<Scheduler>> getSchedulers(String userId, {String? channelId}) async {
    final response = await _dio.get(
      ApiConstants.schedulers,
      queryParameters: {
        'userId': userId,
        if (channelId != null) 'channelId': channelId,
      },
    );
    
    final schedulers = (response.data['schedulers'] as List)
        .map((json) => Scheduler.fromJson(json))
        .toList();
    return schedulers;
  }

  Future<Scheduler> createScheduler(Map<String, dynamic> data) async {
    final response = await _dio.post(
      ApiConstants.schedulers,
      data: data,
    );
    return Scheduler.fromJson(response.data['scheduler']);
  }

  Future<Map<String, dynamic>> getSchedulerDetails(String id) async {
    final response = await _dio.get(ApiConstants.schedulerById(id));
    return {
      'scheduler': Scheduler.fromJson(response.data['scheduler']),
      'recentVideos': (response.data['recentVideos'] as List)
          .map((json) => Video.fromJson(json))
          .toList(),
    };
  }

  Future<Scheduler> updateScheduler(String id, Map<String, dynamic> updates) async {
    final response = await _dio.patch(
      ApiConstants.schedulerById(id),
      data: updates,
    );
    return Scheduler.fromJson(response.data['scheduler']);
  }

  Future<Scheduler> toggleScheduler(String id) async {
    final response = await _dio.post(ApiConstants.schedulerToggle(id));
    return Scheduler.fromJson(response.data['scheduler']);
  }

  Future<void> deleteScheduler(String id) async {
    await _dio.delete(ApiConstants.schedulerById(id));
  }

  // ==================== VIDEOS ====================

  Future<List<Video>> getVideos(
    String userId, {
    String? channelId,
    String? schedulerId,
    String? status,
  }) async {
    final response = await _dio.get(
      ApiConstants.videos,
      queryParameters: {
        'userId': userId,
        if (channelId != null) 'channelId': channelId,
        if (schedulerId != null) 'schedulerId': schedulerId,
        if (status != null) 'status': status,
      },
    );
    
    final videos = (response.data['videos'] as List)
        .map((json) => Video.fromJson(json))
        .toList();
    return videos;
  }

  Future<Video> getVideo(String id) async {
    final response = await _dio.get(ApiConstants.videoById(id));
    return Video.fromJson(response.data['video']);
  }

  Future<Video> updateVideo(String id, Map<String, dynamic> updates) async {
    final response = await _dio.patch(
      ApiConstants.videoById(id),
      data: updates,
    );
    return Video.fromJson(response.data['video']);
  }

  Future<void> uploadVideoNow(String id) async {
    // Get access token from storage and send in request body
    final accessToken = await _storage.read(key: 'access_token');
    if (accessToken == null) {
      throw Exception('Access token not found. Please sign in again.');
    }
    await _dio.post(
      ApiConstants.videoUploadNow(id),
      data: {'accessToken': accessToken},
    );
  }

  Future<void> deleteVideo(String id, String schedulerId) async {
    await _dio.delete(ApiConstants.videoById(id));
    
    // Trigger keep-ahead logic
    await _dio.post(
      ApiConstants.webhookVideoDeleted,
      data: {
        'videoId': id,
        'schedulerId': schedulerId,
      },
    );
  }

  Future<void> uploadThumbnail(String id, String imagePath) async {
    // Send the image as base64 data URL
    final bytes = await File(imagePath).readAsBytes();
    final base64Image = base64Encode(bytes);
    final thumbnailUrl = 'data:image/png;base64,$base64Image';
    
    await _dio.post(
      '${ApiConstants.videoById(id)}/thumbnail',
      data: {'thumbnailUrl': thumbnailUrl},
    );
  }

  // ==================== SETTINGS ====================

  Future<Map<String, dynamic>> getSettings(String userId) async {
    final response = await _dio.get(
      ApiConstants.settings,
      queryParameters: {'userId': userId},
    );
    return response.data as Map<String, dynamic>;
  }

  Future<void> updateSunoKey(String userId, String sunoApiKey) async {
    await _dio.put(
      ApiConstants.settingsSunoKey,
      data: {
        'userId': userId,
        'sunoApiKey': sunoApiKey,
      },
    );
  }

  Future<Map<String, dynamic>> getQuotaUsage(String userId) async {
    final response = await _dio.get(
      ApiConstants.settingsQuota,
      queryParameters: {'userId': userId},
    );
    return response.data as Map<String, dynamic>;
  }
}
