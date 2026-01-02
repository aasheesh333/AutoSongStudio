import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../models/video.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _refreshData();
    _startPolling();
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  void _startPolling() {
    if (_pollingTimer != null && _pollingTimer!.isActive) return;
    
    _pollingTimer = Timer.periodic(const Duration(seconds: 10), (_) async {
      if (!mounted) return;
      
      final appState = Provider.of<AppState>(context, listen: false);
      // Check if we need to poll (if recent videos are processing)
      bool hasActive = appState.videos.any((v) => v.isProcessing || v.isQueued);
      
      if (hasActive || appState.schedulers.any((s) => s.active)) {
         await appState.loadVideos();
      }
    });
  }

  Future<void> _refreshData() async {
    final appState = Provider.of<AppState>(context, listen: false);
    await Future.wait([
      appState.loadSchedulers(),
      appState.loadVideos(),
      appState.loadSettings(),
    ]);
  }

  void _showChannelPicker(BuildContext context, AppState appState) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppTheme.surfaceDark,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text(
                'Switch Channel',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
            ),
            const Divider(),
            ...appState.channels.map((channel) => ListTile(
              leading: CircleAvatar(
                backgroundImage: NetworkImage(channel.thumbnailUrl),
              ),
              title: Text(channel.title),
              subtitle: Text('${channel.subscriberCount} subscribers'),
              trailing: appState.selectedChannel?.id == channel.id
                  ? const Icon(Icons.check_circle, color: AppTheme.primaryColor)
                  : null,
              onTap: () {
                appState.selectChannel(channel);
                Navigator.pop(context);
                _refreshData(); // Reload data for new channel
              },
            )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refreshData,
          child: CustomScrollView(
            slivers: [
              // App Bar
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Consumer<AppState>(
                    builder: (context, appState, _) {
                      final channel = appState.selectedChannel;
                      return Row(
                        children: [
                          // Channel avatar
                          if (channel != null)
                            CircleAvatar(
                              radius: 24,
                              backgroundImage: NetworkImage(channel.thumbnailUrl),
                            ),
                          const SizedBox(width: 12),
                          
                          // Channel info (tappable if multiple channels)
                          Expanded(
                            child: GestureDetector(
                              onTap: () {
                                if (appState.channels.length > 1) {
                                  _showChannelPicker(context, appState);
                                }
                              },
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          channel?.title ?? 'My Channel',
                                          style: Theme.of(context).textTheme.titleMedium,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          '${channel?.subscriberCount ?? '0'} subscribers',
                                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                            color: AppTheme.textSecondary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  if (appState.channels.length > 1)
                                    const Icon(Icons.keyboard_arrow_down, color: AppTheme.textSecondary),
                                ],
                              ),
                            ),
                          ),
                          
                          // Settings button
                          IconButton(
                            onPressed: () => Navigator.pushNamed(context, '/settings'),
                            icon: const Icon(Icons.settings_outlined),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
              
              // Stats Cards
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Consumer<AppState>(
                    builder: (context, appState, _) {
                      final activeSchedulers = appState.schedulers.where((s) => s.active).length;
                      final weekStart = DateTime.now().subtract(const Duration(days: 7));
                      final uploadedThisWeek = appState.videos
                          .where((v) => v.isUploaded && v.uploadedAt!.isAfter(weekStart))
                          .length;
                      
                      return Row(
                        children: [
                          Expanded(
                            child: _StatCard(
                              icon: Icons.schedule,
                              title: 'Scheduled',
                              value: activeSchedulers.toString(),
                              subtitle: 'Active',
                              color: AppTheme.info,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _StatCard(
                              icon: Icons.cloud_upload_outlined,
                              title: 'Uploaded',
                              value: uploadedThisWeek.toString(),
                              subtitle: 'This week',
                              color: AppTheme.success,
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ),
              
              const SliverToBoxAdapter(child: SizedBox(height: 24)),
              
              // Upcoming Releases
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Recent Activity',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      TextButton(
                        onPressed: () => Navigator.pushNamed(context, '/library'),
                        child: const Text('View All'),
                      ),
                    ],
                  ),
                ),
              ),
              
              const SliverToBoxAdapter(child: SizedBox(height: 12)),
              
              // Videos list
              Consumer<AppState>(
                builder: (context, appState, _) {
                  // Show ALL videos - failed, processing, ready, uploaded
                  final allVideos = appState.videos.toList()
                    ..sort((a, b) {
                         // Sort by Created At descending (newest first)
                         return b.createdAt.compareTo(a.createdAt);
                    });
                  
                  // Take top 5
                  final displayVideos = allVideos.take(5).toList();
                  
                  if (displayVideos.isEmpty) {
                    return SliverFillRemaining(
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.video_library_outlined,
                              size: 64,
                              color: AppTheme.textSecondary,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No upcoming videos',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Create a scheduler to start',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      ),
                    );
                  }
                  
                  return SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate(
                        (context, index) {
                          final video = displayVideos[index];
                          return _VideoCard(video: video);
                        },
                        childCount: displayVideos.length,
                      ),
                    ),
                  );
                },
              ),
              
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
      
      // Fab and Bottom Nav remain same...
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/schedulers'),
        backgroundColor: AppTheme.primaryColor,
        icon: const Icon(Icons.rocket_launch),
        label: const Text('Start Automation'),
      ),
      
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          border: Border(
            top: BorderSide(
              color: Colors.white.withOpacity(0.05),
              width: 1,
            ),
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _NavButton(
                  icon: Icons.home,
                  label: 'Home',
                  isActive: true,
                  onTap: () {},
                ),
                _NavButton(
                  icon: Icons.schedule,
                  label: 'Schedulers',
                  onTap: () => Navigator.pushNamed(context, '/schedulers'),
                ),
                _NavButton(
                  icon: Icons.video_library,
                  label: 'Library',
                  onTap: () => Navigator.pushNamed(context, '/library'),
                ),
                _NavButton(
                  icon: Icons.person_outline,
                  label: 'Settings',
                  onTap: () => Navigator.pushNamed(context, '/settings'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// Stat Card Widget
class _StatCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  final String subtitle;
  final Color color;

  const _StatCard({
    required this.icon,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 12),
          Text(
            value,
            style: Theme.of(context).textTheme.displayMedium?.copyWith(
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            title,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          Text(
            subtitle,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _VideoCard extends StatelessWidget {
  final Video video;

  const _VideoCard({required this.video});

  @override
  Widget build(BuildContext context) {
    // Determine info based on status
    String statusText = 'Ready';
    Color statusColor = AppTheme.success;
    String timeText = '';
    
    if (video.isProcessing || video.isQueued) {
        statusText = video.isProcessing ? 'Processing...' : 'Queued';
        statusColor = AppTheme.info; // Blue/Info color
        timeText = 'Generating now...';
    } else if (video.isFailed) {
        statusText = 'Failed';
        statusColor = AppTheme.error;
        timeText = 'Error generating';
    } else {
        // Ready or Uploaded
        final scheduledTime = video.scheduledPublishAt ?? video.createdAt;
        final now = DateTime.now();
        final isToday = scheduledTime.year == now.year &&
            scheduledTime.month == now.month &&
            scheduledTime.day == now.day;
        timeText = isToday
             ? 'Today at ${DateFormat.jm().format(scheduledTime)}'
             : DateFormat('MMM d, h:mm a').format(scheduledTime);
    }
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: AppTheme.cardDecoration(),
      child: InkWell(
        onTap: () {
          Navigator.pushNamed(
            context,
            '/song-detail',
            arguments: video.id,
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              // Thumbnail
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  color: AppTheme.surfaceHighlight,
                ),
                child: video.thumbnailUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          video.thumbnailUrl!,
                          fit: BoxFit.cover,
                        ),
                      )
                    : (video.isProcessing 
                        ? const Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))) 
                        : const Icon(Icons.music_note, size: 32)),
              ),
              
              const SizedBox(width: 12),
              
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      video.title.isEmpty ? 'Generating Title...' : video.title,
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      video.genres.isEmpty ? 'Generating music...' : video.genres.join(' · '),
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Icon(
                          Icons.schedule,
                          size: 14,
                          color: AppTheme.textSecondary,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          timeText,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Status Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: statusColor.withOpacity(0.3),
                  ),
                ),
                child: Text(
                  statusText,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Nav Button Widget
class _NavButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavButton({
    required this.icon,
    required this.label,
    this.isActive = false,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            color: isActive ? AppTheme.primaryColor : AppTheme.textSecondary,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: isActive ? AppTheme.primaryColor : AppTheme.textSecondary,
              fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ],
      ),
    );
  }
}
