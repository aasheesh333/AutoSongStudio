import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../models/scheduler.dart';
import '../theme/app_theme.dart';

class EditSchedulerScreen extends StatefulWidget {
  final Scheduler scheduler;

  const EditSchedulerScreen({super.key, required this.scheduler});

  @override
  State<EditSchedulerScreen> createState() => _EditSchedulerScreenState();
}

class _EditSchedulerScreenState extends State<EditSchedulerScreen> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _titlePromptController;
  late TextEditingController _descPromptController;
  late TextEditingController _tagsPromptController;
  late TextEditingController _lyricsPromptController;
  late List<String> _genres;
  late TextEditingController _genreController;

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _titlePromptController = TextEditingController(text: widget.scheduler.titlePrompt);
    _descPromptController = TextEditingController(text: widget.scheduler.descPrompt);
    _tagsPromptController = TextEditingController(text: widget.scheduler.tagsPrompt);
    _lyricsPromptController = TextEditingController(text: widget.scheduler.lyricsPrompt);
    _genres = List.from(widget.scheduler.genres);
    _genreController = TextEditingController();
  }

  @override
  void dispose() {
    _titlePromptController.dispose();
    _descPromptController.dispose();
    _tagsPromptController.dispose();
    _lyricsPromptController.dispose();
    _genreController.dispose();
    super.dispose();
  }

  void _addGenre() {
    final genre = _genreController.text.trim();
    if (genre.isNotEmpty && !_genres.contains(genre)) {
      setState(() {
        _genres.add(genre);
        _genreController.clear();
      });
    }
  }

  void _removeGenre(String genre) {
    setState(() {
      _genres.remove(genre);
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_genres.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('At least one genre is required')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.updateScheduler(
        widget.scheduler.id,
        {
          'genres': _genres,
          'titlePrompt': _titlePromptController.text.trim(),
          'descPrompt': _descPromptController.text.trim(),
          'tagsPrompt': _tagsPromptController.text.trim(),
          'lyricsPrompt': _lyricsPromptController.text.trim(),
        },
      );

      if (!mounted) return;
      Navigator.pop(context, true); // Return true to indicate success
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Scheduler updated'),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to update: $e'),
            backgroundColor: AppTheme.error,
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Edit Scheduler'),
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _save,
            child: _isSaving
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryColor),
                  )
                : const Text('Save', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Immutable Info
              Container(
                padding: const EdgeInsets.all(16),
                decoration: AppTheme.cardDecoration().copyWith(
                  color: AppTheme.surfaceDark.withOpacity(0.5),
                  border: Border.all(color: Colors.white10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'IMMUTABLE SETTINGS',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 12),
                    _InfoRow('Name', widget.scheduler.name),
                    const SizedBox(height: 8),
                    _InfoRow('Frequency', widget.scheduler.frequencyDisplay),
                    const SizedBox(height: 8),
                    _InfoRow('Language', widget.scheduler.language),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Genres Section
              Text('Genres', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Add genres to guide the music style. The AI will prioritize these.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  ..._genres.map((genre) => Chip(
                    label: Text(genre),
                    deleteIcon: const Icon(Icons.close, size: 16),
                    onDeleted: () => _removeGenre(genre),
                    backgroundColor: AppTheme.primaryColor.withOpacity(0.1),
                    side: BorderSide(color: AppTheme.primaryColor.withOpacity(0.3)),
                  )),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _genreController,
                      decoration: const InputDecoration(
                        hintText: 'Add a genre (e.g. Lo-Fi, Jazz)',
                        isDense: true,
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      onSubmitted: (_) => _addGenre(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  IconButton(
                    onPressed: _addGenre,
                    icon: const Icon(Icons.add_circle, color: AppTheme.primaryColor),
                  ),
                ],
              ),

              const SizedBox(height: 24),

              // Prompts Section
              Text('Content Prompts (Optional)', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(
                'Guide the AI generation for specific fields. Leave blank for fully automatic generation.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: AppTheme.textSecondary),
              ),
              const SizedBox(height: 16),
              
              _PromptField(
                label: 'Title Prompt',
                hint: 'e.g. A song about coding',
                controller: _titlePromptController,
              ),
              const SizedBox(height: 16),
              _PromptField(
                label: 'Description Prompt',
                hint: 'e.g. Relaxing vibes for deep work',
                controller: _descPromptController,
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              _PromptField(
                label: 'Tags Prompt',
                hint: 'e.g. ambient, electronic, study',
                controller: _tagsPromptController,
              ),
              const SizedBox(height: 16),
              _PromptField(
                label: 'Lyrics Prompt',
                hint: 'e.g. Write about bugs and features',
                controller: _lyricsPromptController,
                maxLines: 3,
              ),
              
              const SizedBox(height: 40), // Bottom padding
            ],
          ),
        ),
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow(this.label, this.value);

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text('$label: ', style: TextStyle(color: AppTheme.textSecondary)),
        Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w600))),
      ],
    );
  }
}

class _PromptField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController controller;
  final int maxLines;

  const _PromptField({
    required this.label,
    required this.hint,
    required this.controller,
    this.maxLines = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: Theme.of(context).textTheme.titleSmall),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
          ),
        ),
      ],
    );
  }
}
