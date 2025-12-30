import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:autosong_studio/providers/app_state.dart';
import 'package:autosong_studio/theme/app_theme.dart';
import 'genres_screen.dart';

class ReviewScreen extends StatefulWidget {
  const ReviewScreen({super.key});

  @override
  State<ReviewScreen> createState() => _ReviewScreenState();
}

class _ReviewScreenState extends State<ReviewScreen> {
  late CreateSchedulerData _data;
  bool _isCreating = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _data = ModalRoute.of(context)!.settings.arguments as CreateSchedulerData;
  }

  Future<void> _createScheduler() async {
    setState(() => _isCreating = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      final channelId = appState.selectedChannel?.id;
      
      if (channelId == null) {
        throw Exception('No channel selected');
      }
      
      await appState.createScheduler({
        'userId': appState.currentUser!.id,
        'channelId': channelId,
        'time': _data.time,
        'frequency': _data.frequency,
        'activeDays': _data.activeDays,
        'language': _data.language,
        'genres': _data.genres,
        'titlePrompt': _data.titlePrompt,
        'descPrompt': _data.descPrompt,
        'tagsPrompt': _data.tagsPrompt,
        'lyricsPrompt': _data.lyricsPrompt,
      });
      
      if (!mounted) return;
      
      // Show success and navigate back
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Scheduler created successfully!'),
          backgroundColor: AppTheme.success,
        ),
      );
      
      Navigator.popUntil(context, ModalRoute.withName('/schedulers'));
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to create scheduler: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isCreating = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Scheduler'),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Progress indicator
            LinearProgressIndicator(
              value: 1.0,
              backgroundColor: AppTheme.surfaceDark,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.success),
            ),
            
            const SizedBox(height: 24),
            
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Review & Create',
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Double check your settings before creating',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Summary
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Genres
                    _SectionCard(
                      title: 'Genres (${_data.genres.length})',
                      icon: Icons.music_note,
                      child: Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: _data.genres.asMap().entries.map((entry) {
                          return Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: AppTheme.primaryColor.withOpacity(0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${entry.key + 1}.',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  entry.value,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.primaryColor,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          );
                        }).toList(),
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Schedule
                    _SectionCard(
                      title: 'Schedule',
                      icon: Icons.schedule,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _InfoRow('Frequency', _data.frequency[0].toUpperCase() + _data.frequency.substring(1)),
                          const SizedBox(height: 8),
                          _InfoRow('Time', _formatTime(_data.time)),
                          const SizedBox(height: 8),
                          _InfoRow('Language', _data.language),
                          if (_data.frequency == 'weekly' && _data.activeDays.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            _InfoRow(
                              'Days',
                              _data.activeDays.map((d) => _getDayName(d)).join(', '),
                            ),
                          ],
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 16),
                    
                    // Content Prompts
                    if (_hasAnyPrompt()) ...[
                      _SectionCard(
                        title: 'Content Prompts',
                        icon: Icons.edit_note,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (_data.titlePrompt.isNotEmpty)
                              _PromptRow('Title', _data.titlePrompt),
                            if (_data.descPrompt.isNotEmpty) ...[
                              if (_data.titlePrompt.isNotEmpty) const SizedBox(height: 12),
                              _PromptRow('Description', _data.descPrompt),
                            ],
                            if (_data.tagsPrompt.isNotEmpty) ...[
                              if (_data.titlePrompt.isNotEmpty || _data.descPrompt.isNotEmpty)
                                const SizedBox(height: 12),
                              _PromptRow('Tags', _data.tagsPrompt),
                            ],
                            if (_data.lyricsPrompt.isNotEmpty) ...[
                              if (_data.titlePrompt.isNotEmpty ||
                                  _data.descPrompt.isNotEmpty ||
                                  _data.tagsPrompt.isNotEmpty)
                                const SizedBox(height: 12),
                              _PromptRow('Lyrics', _data.lyricsPrompt),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],
                    
                    // Info card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.success.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppTheme.success.withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.check_circle_outline,
                            color: AppTheme.success,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Your scheduler will automatically generate videos and keep one ready for upload at all times.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.success,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    
                    const SizedBox(height: 20),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
      
      // Create button
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surfaceDark,
          border: Border(
            top: BorderSide(
              color: Colors.white.withOpacity(0.05),
            ),
          ),
        ),
        child: SafeArea(
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _isCreating ? null : () => Navigator.pop(context),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _isCreating ? null : _createScheduler,
                  child: _isCreating
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('Create Scheduler'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _hasAnyPrompt() {
    return _data.titlePrompt.isNotEmpty ||
        _data.descPrompt.isNotEmpty ||
        _data.tagsPrompt.isNotEmpty ||
        _data.lyricsPrompt.isNotEmpty;
  }

  String _formatTime(String time) {
    final parts = time.split(':');
    final hour = int.parse(parts[0]);
    final minute = parts[1];
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    return '$displayHour:$minute $period';
  }

  String _getDayName(int day) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[day % 7];
  }
}

// Section Card Widget
class _SectionCard extends StatelessWidget {
  final String title;
  final IconData icon;
  final Widget child;

  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: AppTheme.primaryColor),
              const SizedBox(width: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppTheme.primaryColor,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          child,
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

// Prompt Row Widget
class _PromptRow extends StatelessWidget {
  final String label;
  final String prompt;

  const _PromptRow(this.label, this.prompt);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppTheme.textSecondary,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          prompt,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}
