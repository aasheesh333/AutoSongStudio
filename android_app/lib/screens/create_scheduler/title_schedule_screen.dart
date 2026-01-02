import 'package:flutter/material.dart';
import 'package:autosong_studio/theme/app_theme.dart';
import 'genres_screen.dart';

class TitleScheduleScreen extends StatefulWidget {
  const TitleScheduleScreen({super.key});

  @override
  State<TitleScheduleScreen> createState() => _TitleScheduleScreenState();
}

class _TitleScheduleScreenState extends State<TitleScheduleScreen> {
  late CreateSchedulerData _data;
  
  final List<String> _languages = [
    'English', 'Hindi', 'Spanish', 'French', 'German', 'Italian',
    'Portuguese', 'Japanese', 'Korean', 'Chinese'
  ];
  
  final List<String> _frequencies = ['daily', 'weekly', 'monthly'];
  final List<String> _weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _data = ModalRoute.of(context)!.settings.arguments as CreateSchedulerData;
  }

  Future<void> _selectTime() async {
    final TimeOfDay? picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(
        hour: int.parse(_data.time.split(':')[0]),
        minute: int.parse(_data.time.split(':')[1]),
      ),
    );
    
    if (picked != null) {
      setState(() {
        _data.time = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
      });
    }
  }

  void _toggleDay(int day) {
    setState(() {
      if (_data.activeDays.contains(day)) {
        _data.activeDays.remove(day);
      } else {
        _data.activeDays.add(day);
      }
    });
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
              value: 0.75,
              backgroundColor: AppTheme.surfaceDark,
              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primaryColor),
            ),
            
            const SizedBox(height: 24),
            
            // Title
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Schedule Settings',
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Configure when videos should be generated',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 24),
            
            // Form
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Language
                    Text(
                      'Language',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _data.language,
                      decoration: const InputDecoration(
                        hintText: 'Select language',
                      ),
                      items: _languages.map((lang) {
                        return DropdownMenuItem(
                          value: lang,
                          child: Text(lang),
                        );
                      }).toList(),
                      onChanged: (value) {
                        if (value != null) {
                          setState(() => _data.language = value);
                        }
                      },
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Frequency
                    Text(
                      'Frequency',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    SegmentedButton<String>(
                      segments: _frequencies.map((freq) {
                        return ButtonSegment(
                          value: freq,
                          label: Text(freq[0].toUpperCase() + freq.substring(1)),
                        );
                      }).toList(),
                      selected: {_data.frequency},
                      onSelectionChanged: (Set<String> selection) {
                        setState(() {
                          _data.frequency = selection.first;
                          if (_data.frequency != 'weekly') {
                            _data.activeDays.clear();
                          }
                        });
                      },
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Active days (only for weekly)
                    if (_data.frequency == 'weekly') ...[
                      Text(
                        'Active Days',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: 8),
                      Wrap(
                        spacing: 8,
                        children: List.generate(7, (index) {
                          final isSelected = _data.activeDays.contains(index);
                          return ChoiceChip(
                            label: Text(_weekDays[index]),
                            selected: isSelected,
                            onSelected: (_) => _toggleDay(index),
                            backgroundColor: AppTheme.surfaceDark,
                            selectedColor: AppTheme.primaryColor,
                            labelStyle: TextStyle(
                              color: isSelected ? Colors.white : AppTheme.textSecondary,
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 24),
                    ],
                    
                    // Time
                    Text(
                      'Time',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    InkWell(
                      onTap: _selectTime,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppTheme.surfaceDark,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: AppTheme.borderDark,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.access_time),
                            const SizedBox(width: 12),
                            Text(
                              _formatTime(_data.time),
                              style: Theme.of(context).textTheme.bodyLarge,
                            ),
                            const Spacer(),
                            Icon(
                              Icons.chevron_right,
                              color: AppTheme.textSecondary,
                            ),
                          ],
                        ),
                      ),
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Info card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppTheme.warning.withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            Icons.warning_amber,
                            color: AppTheme.warning,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Immutable Settings',
                                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                                    color: AppTheme.warning,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Language, frequency, time, and active days cannot be changed after creation.',
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: AppTheme.warning,
                                  ),
                                ),
                              ],
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
      
      // Navigation buttons
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
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: _data.frequency == 'weekly' && _data.activeDays.isEmpty
                      ? null
                      : () {
                          Navigator.pushNamed(
                            context,
                            '/create-scheduler/review',
                            arguments: _data,
                          );
                        },
                  child: const Text('Next: Review'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatTime(String time) {
    final parts = time.split(':');
    final hour = int.parse(parts[0]);
    final minute = parts[1];
    final period = hour >= 12 ? 'PM' : 'AM';
    final displayHour = hour > 12 ? hour - 12 : (hour == 0 ? 12 : hour);
    return '$displayHour:$minute $period';
  }
}
