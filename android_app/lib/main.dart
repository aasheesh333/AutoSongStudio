import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'theme/app_theme.dart';
import 'providers/app_state.dart';
import 'screens/splash_screen.dart';
import 'screens/sign_in_screen.dart';
import 'screens/home_screen.dart';
import 'screens/all_schedulers_screen.dart';
import 'screens/create_scheduler/genres_screen.dart';
import 'screens/create_scheduler/content_prompts_screen.dart';
import 'screens/create_scheduler/title_schedule_screen.dart';
import 'screens/create_scheduler/review_screen.dart';
import 'screens/scheduler_details_screen.dart';
import 'screens/library_screen.dart';
import 'screens/song_detail_screen.dart';
import 'screens/plan_selection_screen.dart';
import 'screens/settings_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize Firebase with error handling
  try {
    await Firebase.initializeApp();
    debugPrint('✅ Firebase initialized successfully');
  } catch (e) {
    debugPrint('⚠️ Firebase initialization failed: $e');
    // App will continue without Firebase - features requiring Firebase won't work
  }
  
  // Set system UI overlay style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppTheme.backgroundDark,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  
  // Lock orientation to portrait
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);
  
  runApp(const AutoSongStudioApp());
}

class AutoSongStudioApp extends StatelessWidget {
  const AutoSongStudioApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: MaterialApp(
        title: 'AutoSong Studio',
        theme: AppTheme.darkTheme,
        debugShowCheckedModeBanner: false,
        initialRoute: '/',
        routes: {
          '/': (context) => const SplashScreen(),
          '/sign-in': (context) => const SignInScreen(),
          '/home': (context) => const HomeScreen(),
          '/schedulers': (context) => const AllSchedulersScreen(),
          '/create-scheduler/genres': (context) => const GenresScreen(),
          '/create-scheduler/prompts': (context) => const ContentPromptsScreen(),
          '/create-scheduler/schedule': (context) => const TitleScheduleScreen(),
          '/create-scheduler/review': (context) => const ReviewScreen(),
          '/scheduler-details': (context) => const SchedulerDetailsScreen(),
          '/library': (context) => const LibraryScreen(),
          '/song-detail': (context) => const SongDetailScreen(),
          '/plan-selection': (context) => const PlanSelectionScreen(),
          '/settings': (context) => const SettingsScreen(),
        },
      ),
    );
  }
}
// Build trigger: Sat Jan 10 19:26:36 UTC 2026
