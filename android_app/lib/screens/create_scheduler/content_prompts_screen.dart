import 'package:flutter/material.dart';
import 'package:autosong_studio/theme/app_theme.dart';
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
    // Validate Lyrics Prompt (REQUIRED)
    if (_lyricsController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Lyrics Prompt is required!'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    _data.titlePrompt = _titleController.text.trim();
    _data.descPrompt = _descController.text.trim();
    _data.tagsPrompt = _tagsController.text.trim();
    _data.lyricsPrompt = _lyricsController.text.trim();
    
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
                    'Lyrics Prompt is REQUIRED. Others are optional.',
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
                      maxLength: 500,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Focus on chill vibes and relaxation"',
                        helperText: 'Guide how video titles should be created (Optional)',
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
                      maxLength: 500,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Include study and focus keywords"',
                        helperText: 'Guide how video descriptions should be written (Optional)',
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
                      maxLength: 500,
                      decoration: const InputDecoration(
                        hintText: 'e.g., "Focus on study, lofi, chill tags"',
                        helperText: 'Guide what type of tags to generate (Optional)',
                      ),
                      maxLines: 2,
                    ),
                    
                    const SizedBox(height: 24),
                    
                    // Lyrics Prompt (REQUIRED)
                    Row(
                      children: [
                        Text(
                          'Lyrics Prompt',
                          style: Theme.of(context).textTheme.titleSmall,
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.red.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            'REQUIRED',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.red,
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _lyricsController,
                      maxLength: 500,
                      decoration: InputDecoration(
                        hintText: 'e.g., "A song about coding and late night debugging"',
                        helperText: 'AI uses this to generate lyrics. Title, Tags, Desc are derived from this.',
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppTheme.primaryColor),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide(color: AppTheme.primaryColor, width: 2),
                        ),
                      ),
                      maxLines: 4,
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
                              'Lyrics Prompt is required. Title, Description, and Tags will be AI-generated from your lyrics if left blank.',
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
