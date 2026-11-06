import 'package:flutter/material.dart';

import 'config.dart';
import 'paths.dart';
import 'scanner.dart';
import 'transfer.dart';

class TransferScreen extends StatefulWidget {
  final ShareConfig cfg;
  final List<LocalItem> items;
  final bool move;
  const TransferScreen({super.key, required this.cfg, required this.items, required this.move});

  @override
  State<TransferScreen> createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  late final TransferJob job =
      TransferJob(cfg: widget.cfg, items: widget.items, move: widget.move);

  @override
  void initState() {
    super.initState();
    job.run();
  }

  @override
  void dispose() {
    job.dispose();
    super.dispose();
  }

  Future<bool> _confirmLeave() async {
    if (!job.running) return true;
    final r = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Stop the transfer?'),
        content: const Text('The file being sent now is finished first. Nothing unconfirmed is removed.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Keep going')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Stop')),
        ],
      ),
    );
    if (r == true) job.cancel();
    return false;
  }

  (IconData, Color?, String) _look(ItemState s, BuildContext context) {
    final err = Theme.of(context).colorScheme.error;
    return switch (s) {
      ItemState.waiting => (Icons.schedule, Colors.grey, 'Waiting'),
      ItemState.sending => (Icons.upload, null, 'Sending'),
      ItemState.sent => (Icons.check_circle, Colors.green, 'Copied'),
      ItemState.alreadyThere => (Icons.check_circle_outline, Colors.green, 'Already on the share'),
      ItemState.failed => (Icons.error, err, 'Failed — still on the phone'),
      ItemState.deleted => (Icons.drive_file_move, Colors.green, 'Moved'),
      ItemState.notDeleted => (Icons.warning_amber, Colors.orange, 'Copied, still on the phone'),
    };
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: job,
      builder: (context, _) {
        final n = widget.items.length;
        final cur = job.currentSize > 0 ? job.currentBytes / job.currentSize : null;
        return PopScope(
          canPop: !job.running,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) _confirmLeave();
          },
          child: Scaffold(
            appBar: AppBar(title: Text(widget.move ? 'Moving' : 'Copying')),
            body: Column(children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(job.status, maxLines: 2, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(value: n == 0 ? 1 : job.processed / n),
                  const SizedBox(height: 4),
                  Text('${job.processed} of $n · ${formatBytes(job.bytesTotal)} sent',
                      style: Theme.of(context).textTheme.bodySmall),
                  if (job.running && cur != null) ...[
                    const SizedBox(height: 8),
                    LinearProgressIndicator(value: cur.clamp(0, 1).toDouble(), minHeight: 2),
                  ],
                  if (job.finished) ...[
                    const SizedBox(height: 12),
                    Wrap(spacing: 8, runSpacing: 4, children: [
                      if (job.sentCount > 0) Chip(label: Text('${job.sentCount} copied')),
                      if (job.alreadyCount > 0) Chip(label: Text('${job.alreadyCount} already there')),
                      if (job.deletedCount > 0) Chip(label: Text('${job.deletedCount} moved')),
                      if (job.notDeletedCount > 0)
                        Chip(label: Text('${job.notDeletedCount} copied but kept on phone')),
                      if (job.failedCount > 0)
                        Chip(
                          label: Text('${job.failedCount} failed'),
                          backgroundColor: Theme.of(context).colorScheme.errorContainer,
                        ),
                    ]),
                  ],
                  const SizedBox(height: 4),
                  const Text('Keep the app open until it finishes.',
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                ]),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView.builder(
                  itemCount: n,
                  itemBuilder: (_, i) {
                    final (icon, color, label) = _look(job.states[i], context);
                    final err = job.errors[i];
                    return ListTile(
                      dense: true,
                      leading: job.states[i] == ItemState.sending
                          ? const SizedBox(
                              width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                          : Icon(icon, color: color),
                      title: Text(widget.items[i].name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(err == null ? label : '$label: $err', maxLines: 3),
                    );
                  },
                ),
              ),
            ]),
            bottomNavigationBar: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: job.running
                    ? OutlinedButton(onPressed: _confirmLeave, child: const Text('Stop'))
                    : FilledButton(onPressed: () => Navigator.pop(context), child: const Text('Done')),
              ),
            ),
          ),
        );
      },
    );
  }
}
