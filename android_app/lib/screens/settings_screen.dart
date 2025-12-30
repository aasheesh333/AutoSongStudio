import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _sunoKeyController = TextEditingController();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final appState = Provider.of<AppState>(context, listen: false);
    await appState.loadSettings();
    
    if (mounted && appState.currentUser?.sunoApiKey != null) {
      _sunoKeyController.text = appState.currentUser!.sunoApiKey!;
    }
  }

  Future<void> _saveSunoKey() async {
    setState(() => _isSaving = true);
    
    try {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.updateSunoKey(_sunoKeyController.text);
      
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('✅ Suno API key saved'),
          backgroundColor: AppTheme.success,
        ),
      );
    } catch (e) {
      if (!mounted) return;
      
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to save: $e'),
          backgroundColor: AppTheme.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  Future<void> _signOut() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign Out?'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.error,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirmed == true && mounted) {
      final appState = Provider.of<AppState>(context, listen: false);
      await appState.signOut();
      
      if (!mounted) return;
      Navigator.pushNamedAndRemoveUntil(context, '/sign-in', (route) => false);
    }
  }

  @override
  void dispose() {
    _sunoKeyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            // App Bar
            SliverAppBar(
              pinned: true,
              title: const Text('Settings'),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            
            // Content
            SliverPadding(
              padding: const EdgeInsets.all(20),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Current Plan
                  Consumer<AppState>(
                    builder: (context, appState, _) {
                      final user = appState.currentUser;
                      
                      return Container(
                        padding: const EdgeInsets.all(20),
                        decoration: AppTheme.gradientCardDecoration(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Current Plan',
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 6,
                                  ),
                                  decoration: BoxDecoration(
                                    color: user?.isPro ?? false
                                        ? AppTheme.primaryColor
                                        : AppTheme.textSecondary,
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    user?.plan.toUpperCase() ?? 'FREE',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                _StatItem(
                                  label: 'Videos this month',
                                  value: '${user?.videosThisMonth ?? 0}',
                                ),
                                const SizedBox(width: 24),
                                _StatItem(
                                  label: 'Active schedulers',
                                  value: '${user?.schedulersCount ?? 0}',
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            SizedBox(
                              width: double.infinity,
                              child: OutlinedButton(
                                onPressed: () {
                                  Navigator.pushNamed(context, '/plan-selection');
                                },
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: AppTheme.primaryColor),
                                ),
                                child: const Text('Change Plan'),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // API Configuration
                  Text(
                    'API Configuration',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  
                  Consumer<AppState>(
                    builder: (context, appState, _) {
                      final requiresKey = appState.currentUser?.requiresSunoKey ?? true;
                      
                      return Container(
                        padding: const EdgeInsets.all(16),
                        decoration: AppTheme.cardDecoration(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.key, size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Suno API Key',
                                  style: Theme.of(context).textTheme.titleSmall,
                                ),
                                if (requiresKey) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppTheme.error.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      'REQUIRED',
                                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                        color: AppTheme.error,
                                        fontSize: 10,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 12),
                            TextField(
                              controller: _sunoKeyController,
                              decoration: const InputDecoration(
                                hintText: 'sk-...',
                                helperText: 'Get your key from suno.com',
                              ),
                              obscureText: true,
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: _isSaving ? null : _saveSunoKey,
                                child: _isSaving
                                    ? const SizedBox(
                                        width: 20,
                                        height: 20,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          valueColor: AlwaysStoppedAnimation<Color>(
                                            Colors.white,
                                          ),
                                        ),
                                      )
                                    : const Text('Save API Key'),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Support & Legal
                  Text(
                    'Support & Legal',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  
                  _SettingsItem(
                    icon: Icons.help_outline,
                    title: 'Help Center',
                    onTap: () {
                      // TODO: Open help center
                    },
                  ),
                  _SettingsItem(
                    icon: Icons.description_outlined,
                    title: 'Terms of Service',
                    onTap: () {
                      // TODO: Open terms
                    },
                  ),
                  _SettingsItem(
                    icon: Icons.privacy_tip_outlined,
                    title: 'Privacy Policy',
                    onTap: () {
                      // TODO: Open privacy policy
                    },
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Account
                  Text(
                    'Account',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  
                  Container(
                    decoration: AppTheme.cardDecoration(),
                    child: ListTile(
                      leading: const Icon(Icons.logout, color: AppTheme.error),
                      title: const Text('Sign Out'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _signOut,
                    ),
                  ),
                  
                  const SizedBox(height: 24),
                  
                  // Version info
                  Center(
                    child: Text(
                      'AutoSong Studio v1.0.0',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppTheme.textSecondary,
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// Stat Item Widget
class _StatItem extends StatelessWidget {
  final String label;
  final String value;

  const _StatItem({
    required this.label,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
            color: AppTheme.primaryColor,
            fontWeight: FontWeight.w800,
          ),
        ),
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: AppTheme.textSecondary,
          ),
        ),
      ],
    );
  }
}

// Settings Item Widget
class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _SettingsItem({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: AppTheme.cardDecoration(),
      child: ListTile(
        leading: Icon(icon),
        title: Text(title),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
