import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import 'genres_screen.dart';

class ContentPromptsScreen extends StatefulWidget {
  const ContentPromptsScreen({super.key});

  @override
  State<ContentPromptsScreen> createState() => _ContentPromptsScreenState();
}

class _ContentPromptsScreenState extends State<ContentPromptsScreen> {
  late CreateSchedulerData _data;
  
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _tagsController = TextEditingController();
  final _lyricsController = TextEditingController();

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _data = ModalRoute.of(context)!.settings.arguments as CreateSchedulerData;
    
    _titleController.text = _data.titlePrompt;
    _descController.text = _data.descPrompt;
    _tagsController.text = _data.tagsPrompt;
    _lyricsController.text = _data.lyricsPrompt;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _tagsController.dispose();
    _lyricsController.dispose();
    super.dispose();
  }

  void _saveAndContinue() {
    _data.titlePrompt = _titleController.text;
    _data.descPrompt = _descController.text;
    _data.tagsPrompt = _tagsController.text;
    _data.lyricsPrompt = _lyricsController.text;
    
    Navigator.pushNamed(
      context,
      '/create-scheduler/schedule',
      arguments: _data,
    );
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
              value: 0.5,
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
                    'Content Prompts',
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Customize AI-generated content (all optional)',
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
                    // Title Prompt
                    Text(
                      'Title Direction',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _titleController,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Focus on chill vibes and relaxation"',
                        helperText: 'Guide how video titles should be created',
                      ),
                      maxLines: 2,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Description Prompt
                    Text(
                      'Description Direction',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _descController,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Include study and focus keywords"',
                        helperText: 'Guide how video descriptions should be written',
                      ),
                      maxLines: 3,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Tags Prompt
                    Text(
                      'Tags Direction',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _tagsController,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Focus on study, lofi, chill tags"',
                        helperText: 'Guide what type of tags to generate',
                      ),
                      maxLines: 2,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Lyrics Prompt
                    Text(
                      'Lyrics Style',
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _lyricsController,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Instrumental only, no vocals"',
                        helperText: 'Guide the style and theme of lyrics',
                      ),
                      maxLines: 3,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Info card
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppTheme.info.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: AppTheme.info.withOpacity(0.3),
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.info_outline,
                            color: AppTheme.info,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'These prompts are optional. Leave blank to use smart defaults based on your selected genres.',
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: AppTheme.info,
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
                  onPressed: _saveAndContinue,
                  child: const Text('Next: Schedule'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
