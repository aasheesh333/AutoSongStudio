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
    _checkAuthStatus();
  }

  Future<void> _checkAuthStatus() async {
    final accessToken = await _storage.read(key: 'access_token');
    _isAuthenticated = accessToken != null;
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
      
      _currentUser = User.fromJson(data['user']);
      _channels = (data['channels'] as List)
          .map((json) => YouTubeChannel.fromJson(json))
          .toList();
      
      if (_channels.isNotEmpty) {
        _selectedChannel = _channels.first;
        await _storage.write(key: 'selected_channel_id', value: _selectedChannel!.id);
      }
      
      _isAuthenticated = true;
      notifyListeners();
    } finally {
      setLoading(false);
    }
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
