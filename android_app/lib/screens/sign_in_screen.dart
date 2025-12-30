import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  bool _isLoading = false;

  Future<void> _signInWithYouTube() async {
    setState(() => _isLoading = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      final authUrl = await appState.getYouTubeAuthUrl();
      
      // Open OAuth in WebView
      if (!mounted) return;
      
      final code = await Navigator.push<String>(
        context,
        MaterialPageRoute(
          builder: (context) => OAuthWebView(authUrl: authUrl),
        ),
      );
      
      if (code != null && mounted) {
        setState(() => _isLoading = true);
        await appState.handleOAuthCallback(code);
        
        if (!mounted) return;
        
        // Load initial data
        await appState.loadSchedulers();
        await appState.loadVideos();
        await appState.loadSettings();
        
        if (!mounted) return;
        Navigator.pushReplacementNamed(context, '/home');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to sign in: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
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

// OAuth WebView
class OAuthWebView extends StatefulWidget {
  final String authUrl;
  
  const OAuthWebView({super.key, required this.authUrl});

  @override
  State<OAuthWebView> createState() => _OAuthWebViewState();
}

class _OAuthWebViewState extends State<OAuthWebView> {
  late final WebViewController _controller;

  @override
  void initState() {
    super.initState();
    
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            // Check for OAuth callback
            if (request.url.contains('jusdown.onrender.com/api/auth/callback')) {
              final uri = Uri.parse(request.url);
              final code = uri.queryParameters['code'];
              
              if (code != null) {
                Navigator.pop(context, code);
                return NavigationDecision.prevent;
              }
            }
            return NavigationDecision.navigate;
          },
        ),
      )
      ..loadRequest(Uri.parse(widget.authUrl));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Sign in with YouTube'),
        leading: IconButton(
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: WebViewWidget(controller: _controller),
    );
  }
}
