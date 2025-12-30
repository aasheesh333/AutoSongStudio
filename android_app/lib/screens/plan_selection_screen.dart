import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../theme/app_theme.dart';

class PlanSelectionScreen extends StatelessWidget {
  const PlanSelectionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Choose Your Plan'),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              // Header
              Text(
                'Unlock Premium Features',
                style: Theme.of(context).textTheme.displayMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                'Scale your YouTube automation with Pro',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              
              const SizedBox(height: 32),
              
              // Free Plan Card
              Consumer<AppState>(
                builder: (context, appState, _) {
                  final isCurrent = appState.currentUser?.isFree ?? true;
                  
                  return _PlanCard(
                    name: 'Free',
                    price: '\$0',
                    period: 'forever',
                    isCurrent: isCurrent,
                    features: const [
                      '6 videos per month',
                      '3 active schedulers',
                      'Bring your own Suno API key',
                      'Standard video quality',
                      'Community support',
                    ],
                    onSelect: () {
                      if (!isCurrent) {
                        // Downgrade logic
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Contact support to downgrade'),
                          ),
                        );
                      }
                    },
                  );
                },
              ),
              
              const SizedBox(height: 16),
              
              // Pro Plan Card
              Consumer<AppState>(
                builder: (context, appState, _) {
                  final isCurrent = appState.currentUser?.isPro ?? false;
                  
                  return _PlanCard(
                    name: 'Pro',
                    price: '\$29',
                    period: 'per month',
                    isCurrent: isCurrent,
                    isPro: true,
                    features: const [
                      'Unlimited videos',
                      'Unlimited schedulers',
                      'Suno API included',
                      'HD video quality',
                      'Priority support',
                      'Advanced analytics',
                      'Custom branding',
                    ],
                    badge: 'POPULAR',
                    onSelect: () {
                      if (!isCurrent) {
                        _showUpgradeDialog(context);
                      }
                    },
                  );
                },
              ),
              
              const SizedBox(height: 24),
              
              // FAQ
              Text(
                'Frequently Asked Questions',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 16),
              
              _FAQItem(
                question: 'Can I cancel anytime?',
                answer: 'Yes, you can cancel your Pro subscription at any time. You\'ll have access until the end of your billing period.',
              ),
              const SizedBox(height: 12),
              _FAQItem(
                question: 'What is a Suno API key?',
                answer: 'Suno is the AI music generation service we use. Free users provide their own API key, while Pro users get unlimited access included.',
              ),
              const SizedBox(height: 12),
              _FAQItem(
                question: 'Can I upgrade later?',
                answer: 'Absolutely! You can upgrade to Pro at any time from the Settings screen.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showUpgradeDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Upgrade to Pro'),
        content: const Text('Pro plan upgrades will be available soon via Stripe integration.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}

// Plan Card Widget
class _PlanCard extends StatelessWidget {
  final String name;
  final String price;
  final String period;
  final bool isCurrent;
  final bool isPro;
  final List<String> features;
  final String? badge;
  final VoidCallback onSelect;

  const _PlanCard({
    required this.name,
    required this.price,
    required this.period,
    required this.isCurrent,
    this.isPro = false,
    required this.features,
    this.badge,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: isPro ? AppTheme.primaryColor.withOpacity(0.1) : null,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isPro
              ? AppTheme.primaryColor
              : Colors.white.withOpacity(0.1),
          width: isPro ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                name,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryColor,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    badge!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                price,
                style: Theme.of(context).textTheme.displayMedium?.copyWith(
                  color: isPro ? AppTheme.primaryColor : null,
                ),
              ),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Text(
                  period,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...features.map((feature) {
            return Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Row(
                children: [
                  Icon(
                    Icons.check_circle,
                    size: 20,
                    color: isPro ? AppTheme.primaryColor : AppTheme.success,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      feature,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: isCurrent ? null : onSelect,
              style: ElevatedButton.styleFrom(
                backgroundColor: isPro ? AppTheme.primaryColor : AppTheme.surfaceDark,
              ),
              child: Text(isCurrent ? 'Current Plan' : 'Select Plan'),
            ),
          ),
        ],
      ),
    );
  }
}

// FAQ Item Widget
class _FAQItem extends StatelessWidget {
  final String question;
  final String answer;

  const _FAQItem({
    required this.question,
    required this.answer,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: AppTheme.cardDecoration(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            question,
            style: Theme.of(context).textTheme.titleSmall,
          ),
          const SizedBox(height: 8),
          Text(
            answer,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: AppTheme.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}
