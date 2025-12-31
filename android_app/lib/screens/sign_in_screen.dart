import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:app_links/app_links.dart';
import 'dart:async';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  bool _isLoading = false;
  late AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initDeepLinks() async {
    _appLinks = AppLinks();
    
    // Check initial link if app was opened via link
    try {
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        _handleDeepLink(initialUri);
      }
    } catch (e) {
      debugPrint('Error getting initial link: $e');
    }

    // Listen for incoming links while app is open
    _linkSubscription = _appLinks.uriLinkStream.listen(
      (uri) {
        _handleDeepLink(uri);
      },
      onError: (err) {
        debugPrint('Error processing link: $err');
      },
    );
  }

  void _handleDeepLink(Uri uri) {
      // Check for Custom Scheme (autosongstudio://auth/callback?access_token=...)
    // OR Web Callback (https://.../callback?code=...)
    
    if (uri.path.contains('/callback')) {
      // Check for Custom Scheme Tokens
      if (uri.queryParameters.containsKey('access_token')) {
        debugPrint('Received access token via custom scheme');
        _completeSignInWithTokens(uri.queryParameters);
        return;
      }
    
      // Check for Code (Web Fallback)
      final code = uri.queryParameters['code'];
      if (code != null) {
        _completeSignIn(code);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Sign in failed: No code received')),
        );
      }
    }
  }

  Future<void> _signInWithYouTube() async {
    setState(() => _isLoading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      final authUrl = await appState.getYouTubeAuthUrl();
      
      // Open System Browser (required by Google)
      // LaunchMode.externalApplication or inAppBrowserView
      // Append state=mobile_app to tell backend to use custom scheme redirect
      // authUrl already has query params so we use &
      final mobileAuthUrl = '$authUrl&state=mobile_app';
      
      final uri = Uri.parse(mobileAuthUrl.trim());
      if (await canLaunchUrl(uri)) {
        await launchUrl(
          uri,
          mode: LaunchMode.externalApplication, // Opens Chrome/System Browser
        );
      } else {
        throw 'Could not launch $authUrl';
      }
      
      // Wait for deep link callback...
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to launch sign in: $e')),
        );
      }
    }
  }

  Future<void> _completeSignIn(String code) async {
    if (!mounted) return;
    
    setState(() => _isLoading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.handleOAuthCallback(code);
      
      if (!mounted) return;
      
      // Load initial data
      await appState.loadSchedulers();
      await appState.loadVideos();
      await appState.loadSettings();
      
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
      
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sign in verification failed: $e')),
        );
      }
    }
  }

  Future<void> _completeSignInWithTokens(Map<String, String> data) async {
    if (!mounted) return;
    
    setState(() => _isLoading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      // Map<String, String> is compatible with Map<String, dynamic>
      await appState.handleOAuthTokens(data);
      
      if (!mounted) return;
      
      // Load initial data
      await appState.loadSchedulers();
      await appState.loadVideos();
      await appState.loadSettings();
      
      if (!mounted) return;
      Navigator.pushReplacementNamed(context, '/home');
      
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sign in failed: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.backgroundDark,
              AppTheme.surfaceDark,
            ],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Spacer(),
                
                // Logo
                Container(
                  width: 120,
                  height: 120,
                  margin: const EdgeInsets.only(bottom: 32),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor,
                    borderRadius: BorderRadius.circular(28),
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primaryColor.withOpacity(0.3),
                        blurRadius: 40,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  child: const Icon(
                    Icons.graphic_eq,
                    size: 60,
                    color: Colors.white,
                  ),
                ),
                
                // Title
                Text(
                  'Welcome to\nAutoSong Studio',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    height: 1.2,
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Subtitle
                Text(
                  'Automate your YouTube music channel\nwith AI-powered content',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                    color: AppTheme.textSecondary,
                    height: 1.5,
                  ),
                ),
                
                const Spacer(),
                
                // Sign in button
                ElevatedButton(
                  onPressed: _isLoading ? null : _signInWithYouTube,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    backgroundColor: Colors.white,
                    foregroundColor: Colors.black87,
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              Colors.black54,
                            ),
                          ),
                        )
                      : Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Image.network(
                              'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg',
                              height: 24,
                              width: 24,
                            ),
                            const SizedBox(width: 12),
                            const Text(
                              'Sign in with YouTube',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                ),
                
                const SizedBox(height: 24),
                
                // Terms
                Text(
                  'By signing in, you agree to our Terms of Service\nand Privacy Policy',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: AppTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
                
                const SizedBox(height: 48),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

