import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../models/video.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  Future<void> _refreshData() async {
    final appState = Provider.of<AppState>(context, listen: false);
    await Future.wait([
      appState.loadSchedulers(),
      appState.loadVideos(),
      appState.loadSettings(),
    ]);
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
                          
                          // Channel info
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
                        'Upcoming Releases',
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
                  final upcomingVideos = appState.videos
                      .where((v) => v.isReady && v.scheduledPublishAt != null)
                      .toList()
                    ..sort((a, b) => a.scheduledPublishAt!.compareTo(b.scheduledPublishAt!));
                  
                  if (upcomingVideos.isEmpty) {
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
                          final video = upcomingVideos[index];
                          return _VideoCard(video: video);
                        },
                        childCount: upcomingVideos.length,
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
      
      // FAB - Start Automation
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/schedulers'),
        backgroundColor: AppTheme.primaryColor,
        icon: const Icon(Icons.rocket_launch),
        label: const Text('Start Automation'),
      ),
      
      // Bottom Navigation
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

// Video Card Widget
class _VideoCard extends StatelessWidget {
  final Video video;

  const _VideoCard({required this.video});

  @override
  Widget build(BuildContext context) {
    final scheduledTime = video.scheduledPublishAt!;
    final now = DateTime.now();
    final isToday = scheduledTime.year == now.year &&
        scheduledTime.month == now.month &&
        scheduledTime.day == now.day;
    
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
                    : const Icon(Icons.music_note, size: 32),
              ),
              
              const SizedBox(width: 12),
              
              // Info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      video.title,
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      video.genres.join(' · '),
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
                          isToday
                              ? 'Today at ${DateFormat.jm().format(scheduledTime)}'
                              : DateFormat('MMM d, h:mm a').format(scheduledTime),
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              
              // Status
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: AppTheme.success.withOpacity(0.3),
                  ),
                ),
                child: Text(
                  'Ready',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.success,
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
