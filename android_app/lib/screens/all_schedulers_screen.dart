import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';
import '../models/scheduler.dart';

class AllSchedulersScreen extends StatefulWidget {
  const AllSchedulersScreen({super.key});

  @override
  State<AllSchedulersScreen> createState() => _AllSchedulersScreenState();
}

class _AllSchedulersScreenState extends State<AllSchedulersScreen> {
  String _selectedFilter = 'All';
  
  @override
  void initState() {
    super.initState();
    _refreshData();
  }

  Future<void> _refreshData() async {
    final appState = Provider.of<AppState>(context, listen: false);
    await appState.loadSchedulers();
  }

  List<Scheduler> _getFilteredSchedulers(List<Scheduler> schedulers) {
    switch (_selectedFilter) {
      case 'Active':
        return schedulers.where((s) => s.active).toList();
      case 'Inactive':
        return schedulers.where((s) => !s.active).toList();
      default:
        return schedulers;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(20),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back),
                    style: IconButton.styleFrom(
                      backgroundColor: AppTheme.surfaceDark,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'All Schedulers',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Consumer<AppState>(
                          builder: (context, appState, _) {
                            return Text(
                              '${appState.schedulers.length} total',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // Filter Tabs
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Row(
                children: [
                  _FilterChip(
                    label: 'All',
                    isSelected: _selectedFilter == 'All',
                    onTap: () => setState(() => _selectedFilter = 'All'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Active',
                    isSelected: _selectedFilter == 'Active',
                    onTap: () => setState(() => _selectedFilter = 'Active'),
                  ),
                  const SizedBox(width: 8),
                  _FilterChip(
                    label: 'Inactive',
                    isSelected: _selectedFilter == 'Inactive',
                    onTap: () => setState(() => _selectedFilter = 'Inactive'),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Schedulers List
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refreshData,
                child: Consumer<AppState>(
                  builder: (context, appState, _) {
                    final filteredSchedulers = _getFilteredSchedulers(appState.schedulers);
                    
                    if (filteredSchedulers.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.schedule,
                              size: 64,
                              color: AppTheme.textSecondary,
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No schedulers found',
                              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                color: AppTheme.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              _selectedFilter == 'All'
                                  ? 'Create your first scheduler'
                                  : 'No $_selectedFilter schedulers',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ],
                        ),
                      );
                    }
                    
                    return ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: filteredSchedulers.length,
                      itemBuilder: (context, index) {
                        final scheduler = filteredSchedulers[index];
                        return _SchedulerCard(scheduler: scheduler);
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
      
      // FAB - Create Scheduler
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, '/create-scheduler/genres'),
        backgroundColor: AppTheme.primaryColor,
        icon: const Icon(Icons.add),
        label: const Text('New Scheduler'),
      ),
    );
  }
}

// Filter Chip Widget
class _FilterChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppTheme.primaryColor : AppTheme.surfaceDark,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isSelected
                ? AppTheme.primaryColor
                : Colors.white.withOpacity(0.1),
          ),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: isSelected ? Colors.white : AppTheme.textSecondary,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}

// Scheduler Card Widget
class _SchedulerCard extends StatelessWidget {
  final Scheduler scheduler;

  const _SchedulerCard({required this.scheduler});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: AppTheme.cardDecoration().copyWith(
        border: (scheduler.error != null && !scheduler.active)
            ? Border.all(color: AppTheme.error, width: 1.5)
            : null,
      ),
      child: InkWell(
        onTap: () {
          Navigator.pushNamed(
            context,
            '/scheduler-details',
            arguments: scheduler.id,
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header
              Row(
                children: [
                  Expanded(
                    child: Text(
                      scheduler.name,
                      style: Theme.of(context).textTheme.titleMedium,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(width: 12),
                  
                  // Toggle switch
                  Consumer<AppState>(
                    builder: (context, appState, _) {
                      return Switch(
                        value: scheduler.active,
                        onChanged: (value) async {
                          // Prevent toggling if error exists? No, user needs to re-enable.
                          // But logically, if they re-enable, we clear error.
                          await appState.toggleScheduler(scheduler.id);
                        },
                        activeColor: AppTheme.success,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        thumbIcon: MaterialStateProperty.resolveWith<Icon?>((states) {
                          if (!scheduler.active && scheduler.error != null) {
                            return Icon(Icons.error, color: AppTheme.error, size: 20);
                          }
                          return null; // Default check/close
                        }),
                        trackColor: MaterialStateProperty.resolveWith<Color?>((states) {
                          if (!scheduler.active && scheduler.error != null) {
                            return AppTheme.error.withOpacity(0.3);
                          }
                          return null;
                        }),
                      );
                    },
                  ),
                ],
              ),

              if (!scheduler.active && scheduler.error != null) ...[
                const SizedBox(height: 8),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.error.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.error.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.error_outline, size: 16, color: AppTheme.error),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Paused: ${scheduler.error}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppTheme.error,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              
              const SizedBox(height: 8),
              
              // Genres
              Wrap(
                spacing: 6,
                runSpacing: 6,
                children: scheduler.genres.take(3).map((genre) {
                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: AppTheme.primaryColor.withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      genre,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.primaryColor,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  );
                }).toList(),
              ),
              
              const SizedBox(height: 12),
              
              // Schedule info
              Row(
                children: [
                  Icon(
                    Icons.schedule,
                    size: 14,
                    color: AppTheme.textSecondary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    scheduler.frequencyDisplay,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                  const Spacer(),
                  Text(
                    scheduler.language.toUpperCase(),
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: AppTheme.textSecondary,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ),
              
              if (scheduler.nextRunAt != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.surfaceHighlight,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.upcoming,
                        size: 14,
                        color: AppTheme.textSecondary,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        'Next: ${_formatNextRun(scheduler.nextRunAt!)}',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppTheme.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _formatNextRun(DateTime nextRun) {
    final now = DateTime.now();
    final difference = nextRun.difference(now);
    
    if (difference.inHours < 24) {
      return 'Today at ${DateFormat.jm().format(nextRun)}';
    } else if (difference.inDays == 1) {
      return 'Tomorrow at ${DateFormat.jm().format(nextRun)}';
    } else {
      return DateFormat('MMM d, h:mm a').format(nextRun);
    }
  }
}
