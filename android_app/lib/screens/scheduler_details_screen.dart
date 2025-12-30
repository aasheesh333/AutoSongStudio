import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../models/scheduler.dart';
import '../models/video.dart';

class SchedulerDetailsScreen extends StatefulWidget {
  const SchedulerDetailsScreen({super.key});

  @override
  State<SchedulerDetailsScreen> createState() => _SchedulerDetailsScreenState();
}

class _SchedulerDetailsScreenState extends State<SchedulerDetailsScreen> {
  Scheduler? _scheduler;
  List<Video> _recentVideos = [];
  bool _isLoading = true;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final schedulerId = ModalRoute.of(context)!.settings.arguments as String;
    _loadSchedulerDetails(schedulerId);
  }

  Future<void> _loadSchedulerDetails(String id) async {
    setState(() => _isLoading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      _scheduler = appState.schedulers.firstWhere((s) => s.id == id);
      await appState.loadVideos(schedulerId: id);
      _recentVideos = appState.videos;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading scheduler: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _deleteScheduler() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Scheduler?'),
        content: const Text('This action cannot be undone. All related videos will remain.'),
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
      await appState.deleteScheduler(_scheduler!.id);
      
      if (!mounted) return;
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _scheduler == null) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // App Bar
            SliverAppBar(
              pinned: true,
              title: Text(_scheduler!.name),
              actions: [
                IconButton(
                  icon: const Icon(Icons.edit),
                  onPressed: () {
                    // Edit scheduler (genres and prompts only)
                    _showEditDialog();
                  },
                ),
                PopupMenuButton(
                  itemBuilder: (context) => [
                    PopupMenuItem(
                      onTap: _deleteScheduler,
                      child: const Row(
                        children: [
                          Icon(Icons.delete, color: AppTheme.error),
                          SizedBox(width: 8),
                          Text('Delete Scheduler'),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
            
            // Content
            SliverPadding(
              padding: const EdgeInsets.all(20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Status toggle
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: AppTheme.cardDecoration(),
                    child: Consumer<AppState>(
                      builder: (context, appState, _) {
                        final scheduler = appState.schedulers.firstWhere(
                          (s) => s.id == _scheduler!.id,
                          orElse: () => _scheduler!,
                        );
                        
                        return Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        width: 8,
                                        height: 8,
                                        decoration: BoxDecoration(
                                          color: scheduler.active
                                              ? AppTheme.success
                                              : AppTheme.textSecondary,
                                          shape: BoxShape.circle,
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        scheduler.active ? 'Active' : 'Inactive',
                                        style: Theme.of(context).textTheme.titleMedium,
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    scheduler.active
                                        ? 'Automatically generating videos'
                                        : 'Paused - no videos being generated',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: AppTheme.textSecondary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Switch(
                              value: scheduler.active,
                              onChanged: (value) async {
                                await appState.toggleScheduler(scheduler.id);
                              },
                              activeColor: AppTheme.success,
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Schedule Info (Read-only)
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: AppTheme.cardDecoration(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.schedule, size: 20, color: AppTheme.primaryColor),
                            const SizedBox(width: 8),
                            Text(
                              'Schedule Settings',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: AppTheme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _InfoRow('Frequency', _scheduler!.frequencyDisplay),
                        const SizedBox(height: 8),
                        _InfoRow('Language', _scheduler!.language),
                        if (_scheduler!.nextRunAt != null) ...[
                          const SizedBox(height: 8),
                          _InfoRow(
                            'Next Run',
                            DateFormat('MMM d, h:mm a').format(_scheduler!.nextRunAt!),
                          ),
                        ],
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Genres
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: AppTheme.cardDecoration(),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.music_note, size: 20, color: AppTheme.primaryColor),
                            const SizedBox(width: 8),
                            Text(
                              'Genres',
                              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                color: AppTheme.primaryColor,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _scheduler!.genres.map((genre) {
                            return Chip(
                              label: Text(genre),
                              backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                              side: BorderSide(
                                color: AppTheme.primaryColor.withOpacity(0.3),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ),
                  ),
                  
                  const SizedBox(height: 20),
                  
                  // Recent Videos
                  Text(
                    'Recent Videos (${_recentVideos.length})',
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  
                  const SizedBox(height: 12),
                  
                  if (_recentVideos.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(32),
                      decoration: AppTheme.cardDecoration(),
                      child: Center(
                        child: Column(
                          children: [
                            Icon(
                              Icons.video_library_outlined,
                              size: 48,
                              color: AppTheme.textSecondary,
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'No videos yet',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    ..._recentVideos.map((video) {
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: AppTheme.cardDecoration(),
                        child: ListTile(
                          contentPadding: const EdgeInsets.all(12),
                          leading: Container(
                            width: 60,
                            height: 60,
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
                                : const Icon(Icons.music_note),
                          ),
                          title: Text(
                            video.title,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          subtitle: Text(
                            video.statusDisplay,
                            style: TextStyle(
                              color: _getStatusColor(video.status),
                            ),
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () {
                            Navigator.pushNamed(
                              context,
                              '/song-detail',
                              arguments: video.id,
                            );
                          },
                        ),
                      );
                    }),
                ]),
              ),
            ),
          ],
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

  void _showEditDialog() {
    // TODO: Implement edit dialog for genres and prompts
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Edit Scheduler'),
        content: const Text('Editing functionality coming soon.\n\nYou can edit: Genres and Content Prompts\nYou cannot edit: Time, Frequency, Language'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

// Info Row Widget
class _InfoRow extends StatelessWidget {
  final String label;
  final String value;

  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '$label:',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: AppTheme.textSecondary,
          ),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
