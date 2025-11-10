import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import {
  Settings,
  Plus,
  Edit,
  Trash2,
  TrendingUp,
  DollarSign,
  Percent,
  AlertTriangle
} from 'lucide-react';

interface AgentTier {
  id: number;
  tier_name: string;
  min_amount: number;
  max_amount: number;
  daily_reward_min_bp: number;
  daily_reward_max_bp: number;
  reward_cap_bp: number;
  created_at: string;
  updated_at: string;
}

interface TierFormData {
  tier_name: string;
  min_amount: string;
  max_amount: string;
  daily_reward_min_bp: string;
  daily_reward_max_bp: string;
  reward_cap_bp: string;
}

export function AgentTiersManagement() {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<AgentTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<AgentTier | null>(null);

  const [formData, setFormData] = useState<TierFormData>({
    tier_name: '',
    min_amount: '',
    max_amount: '',
    daily_reward_min_bp: '',
    daily_reward_max_bp: '',
    reward_cap_bp: '',
  });

  const loadTiers = async () => {
    try {
      setLoading(true);
      const baseUrl = API_CONFIG.getBaseUrl();
      const response = await ApiClient.get(`${baseUrl}/admin/agent-tiers`);
      const data = await response.json();
      setTiers(data);
    } catch (error) {
      console.error('Error loading agent tiers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load agent tiers',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTiers();
  }, []);

  const resetForm = () => {
    setFormData({
      tier_name: '',
      min_amount: '',
      max_amount: '',
      daily_reward_min_bp: '',
      daily_reward_max_bp: '',
      reward_cap_bp: '',
    });
    setEditingTier(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (tier: AgentTier) => {
    setFormData({
      tier_name: tier.tier_name,
      min_amount: (tier.min_amount / 1_000_000).toString(), // Convert from micro-USDT
      max_amount: (tier.max_amount / 1_000_000).toString(),
      daily_reward_min_bp: tier.daily_reward_min_bp.toString(),
      daily_reward_max_bp: tier.daily_reward_max_bp.toString(),
      reward_cap_bp: tier.reward_cap_bp.toString(),
    });
    setEditingTier(tier);
    setDialogOpen(true);
  };

  const validateForm = (): boolean => {
    const minAmount = parseFloat(formData.min_amount);
    const maxAmount = parseFloat(formData.max_amount);
    const minReward = parseInt(formData.daily_reward_min_bp);
    const maxReward = parseInt(formData.daily_reward_max_bp);
    const cap = parseInt(formData.reward_cap_bp);

    if (!formData.tier_name.trim()) {
      toast({ title: 'Validation Error', description: 'Tier name is required', variant: 'destructive' });
      return false;
    }

    if (minAmount <= 0 || maxAmount <= 0 || minAmount >= maxAmount) {
      toast({ title: 'Validation Error', description: 'Invalid amount range', variant: 'destructive' });
      return false;
    }

    if (minReward <= 0 || maxReward <= 0 || minReward >= maxReward) {
      toast({ title: 'Validation Error', description: 'Invalid reward range', variant: 'destructive' });
      return false;
    }

    if (cap < 10000) {
      toast({ title: 'Validation Error', description: 'Reward cap must be at least 100%', variant: 'destructive' });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);
      const baseUrl = API_CONFIG.getBaseUrl();

      const payload = {
        tier_name: formData.tier_name,
        min_amount: Math.floor(parseFloat(formData.min_amount) * 1_000_000), // Convert to micro-USDT
        max_amount: Math.floor(parseFloat(formData.max_amount) * 1_000_000),
        daily_reward_min_bp: parseInt(formData.daily_reward_min_bp),
        daily_reward_max_bp: parseInt(formData.daily_reward_max_bp),
        reward_cap_bp: parseInt(formData.reward_cap_bp),
      };

      if (editingTier) {
        // Update existing tier
        await ApiClient.put(`${baseUrl}/admin/agent-tiers/${editingTier.id}`, payload);
        toast({
          title: 'Success',
          description: 'Agent tier updated successfully',
        });
      } else {
        // Create new tier
        await ApiClient.post(`${baseUrl}/admin/agent-tiers`, payload);
        toast({
          title: 'Success',
          description: 'Agent tier created successfully',
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadTiers();
    } catch (error: any) {
      console.error('Error saving agent tier:', error);
      const message = error.message || 'Failed to save agent tier';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tier: AgentTier) => {
    if (!confirm(`Are you sure you want to delete the ${tier.tier_name} tier? This action cannot be undone.`)) {
      return;
    }

    try {
      const baseUrl = API_CONFIG.getBaseUrl();
      await ApiClient.delete(`${baseUrl}/admin/agent-tiers/${tier.id}`);
      toast({
        title: 'Success',
        description: 'Agent tier deleted successfully',
      });
      await loadTiers();
    } catch (error: any) {
      console.error('Error deleting agent tier:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete agent tier',
        variant: 'destructive',
      });
    }
  };

  const formatUsdt = (microAmount: number) => {
    return (microAmount / 1_000_000).toFixed(2);
  };

  const formatBps = (bps: number) => {
    return (bps / 100).toFixed(2);
  };

  if (loading) {
    return (
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            <span className="ml-2 text-gray-400">Loading agent tiers...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900/50 border-gray-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-6 w-6 text-green-400" />
              <div>
                <CardTitle className="text-white">Agent Tiers Management</CardTitle>
                <p className="text-gray-400 text-sm">Configure agent investment tiers and reward parameters</p>
              </div>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog} className="bg-green-600 hover:bg-green-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tier
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-gray-900 border-gray-800 max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editingTier ? 'Edit Agent Tier' : 'Create Agent Tier'}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tier_name" className="text-gray-300">Tier Name</Label>
                    <Input
                      id="tier_name"
                      value={formData.tier_name}
                      onChange={(e) => setFormData({ ...formData, tier_name: e.target.value })}
                      placeholder="e.g., NOVA, VEGA, ORION"
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={saving}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min_amount" className="text-gray-300">Min Amount (USDT)</Label>
                      <Input
                        id="min_amount"
                        type="number"
                        step="0.01"
                        value={formData.min_amount}
                        onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                        placeholder="50.00"
                        className="bg-gray-800 border-gray-700 text-white"
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max_amount" className="text-gray-300">Max Amount (USDT)</Label>
                      <Input
                        id="max_amount"
                        type="number"
                        step="0.01"
                        value={formData.max_amount}
                        onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                        placeholder="999.99"
                        className="bg-gray-800 border-gray-700 text-white"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="daily_reward_min_bp" className="text-gray-300">Min Daily Reward (%)</Label>
                      <Input
                        id="daily_reward_min_bp"
                        type="number"
                        step="0.01"
                        value={formData.daily_reward_min_bp}
                        onChange={(e) => setFormData({ ...formData, daily_reward_min_bp: e.target.value })}
                        placeholder="1.00"
                        className="bg-gray-800 border-gray-700 text-white"
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="daily_reward_max_bp" className="text-gray-300">Max Daily Reward (%)</Label>
                      <Input
                        id="daily_reward_max_bp"
                        type="number"
                        step="0.01"
                        value={formData.daily_reward_max_bp}
                        onChange={(e) => setFormData({ ...formData, daily_reward_max_bp: e.target.value })}
                        placeholder="1.95"
                        className="bg-gray-800 border-gray-700 text-white"
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reward_cap_bp" className="text-gray-300">Reward Cap (%)</Label>
                    <Input
                      id="reward_cap_bp"
                      type="number"
                      step="0.01"
                      value={formData.reward_cap_bp}
                      onChange={(e) => setFormData({ ...formData, reward_cap_bp: e.target.value })}
                      placeholder="175.00"
                      className="bg-gray-800 border-gray-700 text-white"
                      disabled={saving}
                    />
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleSubmit}
                      disabled={saving}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      {saving ? 'Saving...' : (editingTier ? 'Update' : 'Create')}
                    </Button>
                    <Button
                      onClick={() => setDialogOpen(false)}
                      variant="outline"
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-gray-800">
                <TableHead className="text-gray-300">Tier Name</TableHead>
                <TableHead className="text-gray-300">Investment Range</TableHead>
                <TableHead className="text-gray-300">Daily Rewards</TableHead>
                <TableHead className="text-gray-300">Reward Cap</TableHead>
                <TableHead className="text-gray-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.id} className="border-gray-800">
                  <TableCell className="text-white font-medium">
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                      {tier.tier_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-3 w-3" />
                      ${formatUsdt(tier.min_amount)} - ${formatUsdt(tier.max_amount)}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {formatBps(tier.daily_reward_min_bp)}% - {formatBps(tier.daily_reward_max_bp)}%
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-300">
                    <div className="flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      {formatBps(tier.reward_cap_bp)}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => openEditDialog(tier)}
                        variant="outline"
                        size="sm"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        onClick={() => handleDelete(tier)}
                        variant="outline"
                        size="sm"
                        className="border-red-700 text-red-400 hover:bg-red-900/20"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {tiers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    No agent tiers configured yet. Click "Add Tier" to create your first tier.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {tiers.length === 0 && (
        <Card className="bg-yellow-900/20 border-yellow-800">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <div>
                <h4 className="text-yellow-400 font-medium">No Agent Tiers Configured</h4>
                <p className="text-yellow-300 text-sm">
                  Agent tiers must be configured before users can hire agents. Create at least one tier to enable agent functionality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}