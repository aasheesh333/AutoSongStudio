import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../models/scheduler.dart';
import '../models/video.dart';
import '../services/api_service.dart';

class AppState extends ChangeNotifier {
  final ApiService _api = ApiService();
  final _storage = const FlutterSecureStorage();

  // Authentication state
  User? _currentUser;
  List<YouTubeChannel> _channels = [];
  YouTubeChannel? _selectedChannel;
  bool _isAuthenticated = false;
  bool _isLoading = false;

  // Data state
  List<Scheduler> _schedulers = [];
  List<Video> _videos = [];
  Map<String, dynamic>? _settings;

  // Getters
  User? get currentUser => _currentUser;
  List<YouTubeChannel> get channels => _channels;
  YouTubeChannel? get selectedChannel => _selectedChannel;
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  List<Scheduler> get schedulers => _schedulers;
  List<Video> get videos => _videos;
  Map<String, dynamic>? get settings => _settings;

  AppState() {
    // Don't call async method in constructor without awaiting
    // We will call checkAuthStatus explicitly from SplashScreen
  }

  Future<void> checkAuthStatus() async {
    final accessToken = await _storage.read(key: 'access_token');
    if (accessToken != null) {
      _isAuthenticated = true;
      
      // Restore user data from storage
      final userData = await _storage.read(key: 'user_data');
      if (userData != null) {
        try {
          _currentUser = User.fromJson(jsonDecode(userData));
        } catch (e) {
          print('Error restoring user data: $e');
        }
      }
    } else {
      _isAuthenticated = false;
    }
    notifyListeners();
  }

  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  // ==================== AUTH ====================

  Future<String> getYouTubeAuthUrl() async {
    return await _api.getYouTubeAuthUrl();
  }

  Future<void> handleOAuthCallback(String code) async {
    setLoading(true);
    try {
      final data = await _api.handleOAuthCallback(code);
      await _processAuthData(data);
    } finally {
      setLoading(false);
    }
  }

  Future<void> handleOAuthTokens(Map<String, dynamic> data) async {
    setLoading(true);
    try {
      // Data is already in the format we expect (from URL params)
      // but 'channels' might need decoding if passed as JSON string
      if (data['channels'] is String) {
        // Decode logic should happen in UI or here? 
        // Ideally we expect parsed objects, but if we pass raw map:
        // We will assume 'channels' is already parsed valid List/Object 
        // OR we handle it in _processAuthData if generic.
      }
      
      // Since data structure from URL might differ slightly (flat params vs nested),
      // we need to normalize it or ensure _processAuthData handles it.
      // But to save time, let's write custom logic here or reuse.
      
      // Let's create a _processAuthData helper first to reuse logic
      await _processAuthData(data);
    } finally {
      setLoading(false);
    }
  }

  Future<void> _processAuthData(Map<String, dynamic> data) async {
      // Normalize user data
      if (data.containsKey('user')) {
         _currentUser = User.fromJson(data['user']);
      } else if (data.containsKey('user_id')) {
         // Constructed from URL params
         _currentUser = User(
            id: data['user_id'],
            email: data['email'],
            plan: data['plan'] ?? 'free',
            youtubeRefreshToken: '', // Not needed in frontend model usually
         );
      }

      // Handle Channels
      if (data['channels'] != null) {
        var channelsData = data['channels'];
        if (channelsData is String) {
           try {
             channelsData = jsonDecode(Uri.decodeComponent(channelsData));
           } catch (e) {
             print('Error decoding channels JSON: $e');
             channelsData = [];
           }
        }
        
        if (channelsData is List) {
           _channels = channelsData
              .map((json) => YouTubeChannel.fromJson(json))
              .toList();
        }
      }
      
      if (_channels.isNotEmpty) {
        _selectedChannel = _channels.first;
        await _storage.write(key: 'selected_channel_id', value: _selectedChannel!.id);
      }
      
      // Save Tokens
      if (data.containsKey('tokens')) {
        final tokens = data['tokens'];
        await _storage.write(key: 'access_token', value: tokens['accessToken']);
        await _storage.write(key: 'refresh_token', value: tokens['refreshToken']);
      } else if (data.containsKey('access_token')) {
        await _storage.write(key: 'access_token', value: data['access_token']);
        await _storage.write(key: 'refresh_token', value: data['refresh_token']);
      }
      
      // Save User Data to storage for persistence across app restarts
      if (_currentUser != null) {
        await _storage.write(key: 'user_data', value: jsonEncode(_currentUser!.toJson()));
      }
      
      _isAuthenticated = true;
      notifyListeners();
  }

  Future<void> loadChannels() async {
    try {
      _channels = await _api.getChannels();
      
      // Load saved channel preference
      final savedChannelId = await _storage.read(key: 'selected_channel_id');
      if (savedChannelId != null) {
        _selectedChannel = _channels.firstWhere(
          (c) => c.id == savedChannelId,
          orElse: () => _channels.first,
        );
      } else if (_channels.isNotEmpty) {
        _selectedChannel = _channels.first;
      }
      
      notifyListeners();
    } catch (e) {
      print('Error loading channels: $e');
    }
  }

  Future<void> selectChannel(YouTubeChannel channel) async {
    _selectedChannel = channel;
    await _storage.write(key: 'selected_channel_id', value: channel.id);
    
    // Reload schedulers and videos for this channel
    if (_currentUser != null) {
      await loadSchedulers();
      await loadVideos();
    }
    
    notifyListeners();
  }

  Future<void> signOut() async {
    await _api.signOut();
    _currentUser = null;
    _channels = [];
    _selectedChannel = null;
    _isAuthenticated = false;
    _schedulers = [];
    _videos = [];
    _settings = null;
    
    // Clear persisted user data
    await _storage.delete(key: 'user_data');
    await _storage.delete(key: 'selected_channel_id');
    
    notifyListeners();
  }

  // ==================== SCHEDULERS ====================

  Future<void> loadSchedulers() async {
    if (_currentUser == null) return;
    
    try {
      _schedulers = await _api.getSchedulers(
        _currentUser!.id,
        channelId: _selectedChannel?.id,
      );
      notifyListeners();
    } catch (e) {
      print('Error loading schedulers: $e');
    }
  }

  Future<Scheduler> createScheduler(Map<String, dynamic> data) async {
    final scheduler = await _api.createScheduler(data);
    _schedulers.add(scheduler);
    notifyListeners();
    return scheduler;
  }

  Future<void> updateScheduler(String id, Map<String, dynamic> updates) async {
    final updated = await _api.updateScheduler(id, updates);
    final index = _schedulers.indexWhere((s) => s.id == id);
    if (index != -1) {
      _schedulers[index] = updated;
      notifyListeners();
    }
  }

  Future<void> toggleScheduler(String id) async {
    final updated = await _api.toggleScheduler(id);
    final index = _schedulers.indexWhere((s) => s.id == id);
    if (index != -1) {
      _schedulers[index] = updated;
      notifyListeners();
    }
  }

  Future<void> deleteScheduler(String id) async {
    await _api.deleteScheduler(id);
    _schedulers.removeWhere((s) => s.id == id);
    notifyListeners();
  }

  // ==================== VIDEOS ====================

  Future<void> loadVideos({String? schedulerId, String? status}) async {
    if (_currentUser == null) return;
    
    try {
      _videos = await _api.getVideos(
        _currentUser!.id,
        channelId: _selectedChannel?.id,
        schedulerId: schedulerId,
        status: status,
      );
      notifyListeners();
    } catch (e) {
      print('Error loading videos: $e');
    }
  }

  Future<void> updateVideo(String id, Map<String, dynamic> updates) async {
    final updated = await _api.updateVideo(id, updates);
    final index = _videos.indexWhere((v) => v.id == id);
    if (index != -1) {
      _videos[index] = updated;
      notifyListeners();
    }
  }

  Future<void> uploadVideoNow(String id) async {
    await _api.uploadVideoNow(id);
    // Reload videos to get updated status
    await loadVideos();
  }

  Future<void> deleteVideo(String id, String schedulerId) async {
    await _api.deleteVideo(id, schedulerId);
    _videos.removeWhere((v) => v.id == id);
    notifyListeners();
  }

  // ==================== SETTINGS ====================

  Future<void> loadSettings() async {
    if (_currentUser == null) return;
    
    try {
      _settings = await _api.getSettings(_currentUser!.id);
      
      // Update user from settings
      if (_settings != null && _settings!['user'] != null) {
        _currentUser = User.fromJson(_settings!['user']);
        
        // Re-persist updated user data (e.g., after Suno key save)
        await _storage.write(key: 'user_data', value: jsonEncode(_currentUser!.toJson()));
      }
      
      notifyListeners();
    } catch (e) {
      print('Error loading settings: $e');
    }
  }

  Future<void> updateSunoKey(String sunoApiKey) async {
    if (_currentUser == null) return;
    
    await _api.updateSunoKey(_currentUser!.id, sunoApiKey);
    await loadSettings();
  }

  Future<Map<String, dynamic>> getQuotaUsage() async {
    if (_currentUser == null) return {};
    return await _api.getQuotaUsage(_currentUser!.id);
  }
}
