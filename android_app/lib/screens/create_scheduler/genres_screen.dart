import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class CreateSchedulerData {
  List<String> genres = [];
  String language = 'English';
  String titlePrompt = '';
  String descPrompt = '';
  String tagsPrompt = '';
  String lyricsPrompt = '';
  String time = '10:00';
  String frequency = 'daily';
  List<int> activeDays = [];
}

class GenresScreen extends StatefulWidget {
  const GenresScreen({super.key});

  @override
  State<GenresScreen> createState() => _GenresScreenState();
}

class _GenresScreenState extends State<GenresScreen> {
  final _data = CreateSchedulerData();
  final _searchController = TextEditingController();
  String _searchQuery = '';

  final List<String> _allGenres = [
    'Lofi', 'Phonk', 'Jazz', 'Classical', 'Rock', 'Pop', 'Electronic',
    'Hip Hop', 'R&B', 'Country', 'Blues', 'Reggae', 'Metal', 'Punk',
    'Folk', 'Soul', 'Funk', 'Disco', 'House', 'Techno', 'Trance',
    'Dubstep', 'Drum & Bass', 'Ambient', 'Chillout', 'Downtempo',
    'Synthwave', 'Vaporwave', 'Indie', 'Alternative', 'Trap',
  ];

  List<String> get _filteredGenres {
    if (_searchQuery.isEmpty) return _allGenres;
    return _allGenres
        .where((genre) => genre.toLowerCase().contains(_searchQuery.toLowerCase()))
        .toList();
  }

  void _toggleGenre(String genre) {
    setState(() {
      if (_data.genres.contains(genre)) {
        _data.genres.remove(genre);
      } else {
        _data.genres.add(genre);
      }
    });
  }

  void _moveGenreUp(int index) {
    if (index > 0) {
      setState(() {
        final genre = _data.genres.removeAt(index);
        _data.genres.insert(index - 1, genre);
      });
    }
  }

  void _moveGenreDown(int index) {
    if (index < _data.genres.length - 1) {
      setState(() {
        final genre = _data.genres.removeAt(index);
        _data.genres.insert(index + 1, genre);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Create Scheduler'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Progress indicator
            LinearProgressIndicator(
              value: 0.25,
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
                    'Select Genres',
                    style: Theme.of(context).textTheme.displayMedium,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Choose genres in priority order. First genre will be primary.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Search bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search genres...',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchQuery.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchController.clear();
                            setState(() => _searchQuery = '');
                          },
                        )
                      : null,
                ),
                onChanged: (value) => setState(() => _searchQuery = value),
              ),
            ),
            
            const SizedBox(height: 20),
            
            // Selected genres (priority queue)
            if (_data.genres.isNotEmpty) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Text(
                  'Priority Order (${_data.genres.length} selected)',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(12),
                decoration: AppTheme.cardDecoration(),
                child: ReorderableListView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  itemCount: _data.genres.length,
                  onReorder: (oldIndex, newIndex) {
                    setState(() {
                      if (newIndex > oldIndex) newIndex--;
                      final genre = _data.genres.removeAt(oldIndex);
                      _data.genres.insert(newIndex, genre);
                    });
                  },
                  itemBuilder: (context, index) {
                    final genre = _data.genres[index];
                    return Container(
                      key: ValueKey(genre),
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppTheme.surfaceHighlight,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.drag_handle,
                            size: 20,
                            color: AppTheme.textSecondary,
                          ),
                          const SizedBox(width: 12),
                          Text(
                            '${index + 1}.',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                              color: AppTheme.primaryColor,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              genre,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.close, size: 18),
                            onPressed: () => _toggleGenre(genre),
                            color: AppTheme.textSecondary,
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
            ],
            
            // Available genres
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Text(
                'Available Genres',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: AppTheme.textSecondary,
                ),
              ),
            ),
            
            const SizedBox(height: 12),
            
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _filteredGenres.map((genre) {
                    final isSelected = _data.genres.contains(genre);
                    return ChoiceChip(
                      label: Text(genre),
                      selected: isSelected,
                      onSelected: (_) => _toggleGenre(genre),
                      backgroundColor: AppTheme.surfaceDark,
                      selectedColor: AppTheme.primaryColor,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : AppTheme.textSecondary,
                        fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
      
      // Next button
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
          child: ElevatedButton(
            onPressed: _data.genres.isEmpty
                ? null
                : () {
                    Navigator.pushNamed(
                      context,
                      '/create-scheduler/prompts',
                      arguments: _data,
                    );
                  },
            child: const Text('Next: Content Prompts'),
          ),
        ),
      ),
    );
  }
}
