import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, Save, Ban, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ApiClient, API_CONFIG } from '@/config/service-endpoints';
import { UserLookup, UserInfo } from './UserLookup';

interface WithdrawalSettings {
    agent_pnl_withdrawal_enabled: boolean;
    agent_pnl_withdrawal_limit: string | null; // BigInt as string from backend
}

export function WithdrawalManagement() {
    const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
    const [settings, setSettings] = useState<WithdrawalSettings | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Form state
    const [isEnabled, setIsEnabled] = useState(true);
    const [limitUsdt, setLimitUsdt] = useState<string>('');
    const [hasLimit, setHasLimit] = useState(false);

    const handleUserFound = (user: UserInfo) => {
        setSelectedUser(user);
        if (user.exists) {
            fetchSettings(user.address);
        } else {
            setSettings(null);
        }
    };

    const fetchSettings = async (address: string) => {
        setIsLoading(true);
        try {
            // Re-fetch user details to get latest settings (UserLookup might not have them if cached or partial)
            // Actually UserLookup calls /users/:address which we updated to return these fields.
            // But UserInfo interface in UserLookup might not have them mapped yet.
            // So let's fetch directly or rely on UserLookup update.
            // Since I didn't update UserLookup.tsx to map these fields, I should fetch them here or update UserLookup.
            // Updating UserLookup is better but for now I'll just fetch user data again to be safe/explicit.

            const response = await ApiClient.get(`${API_CONFIG.getBaseUrl()}/users/${address}`);
            if (response.ok) {
                const data = await response.json();
                setSettings({
                    agent_pnl_withdrawal_enabled: data.agent_pnl_withdrawal_enabled ?? true,
                    agent_pnl_withdrawal_limit: data.agent_pnl_withdrawal_limit
                });

                setIsEnabled(data.agent_pnl_withdrawal_enabled ?? true);
                if (data.agent_pnl_withdrawal_limit) {
                    setHasLimit(true);
                    setLimitUsdt((Number(data.agent_pnl_withdrawal_limit) / 1_000_000).toString());
                } else {
                    setHasLimit(false);
                    setLimitUsdt('');
                }
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            toast.error('Failed to load user settings');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        if (!selectedUser) return;

        setIsSaving(true);
        try {
            const limitMicro = hasLimit && limitUsdt
                ? Math.floor(parseFloat(limitUsdt) * 1_000_000)
                : null;

            const response = await ApiClient.post(
                `${API_CONFIG.getBaseUrl()}/users/${selectedUser.address}/withdrawal-settings`,
                {
                    enabled: isEnabled,
                    limit: limitMicro
                }
            );

            if (response.ok) {
                toast.success('Withdrawal settings updated');
                fetchSettings(selectedUser.address); // Refresh
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Failed to update');
            }
        } catch (error) {
            console.error('Save error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to save settings');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-red-400" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Withdrawal Management</h1>
                    <p className="text-gray-400">Manage user withdrawal limits and bans</p>
                </div>
            </div>

            <UserLookup onUserFound={handleUserFound} />

            {selectedUser && selectedUser.exists && (
                <Card className="bg-gray-900/50 border-gray-800">
                    <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                            <Shield className="h-5 w-5 text-blue-400" />
                            Withdrawal Controls
                        </CardTitle>
                        <CardDescription>
                            Configure Agent PnL withdrawal restrictions for this user
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {isLoading ? (
                            <div className="flex justify-center p-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                            </div>
                        ) : (
                            <>
                                {/* Enable/Disable Switch */}
                                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <div className="space-y-1">
                                        <Label className="text-base font-medium text-white">
                                            Agent PnL Withdrawals
                                        </Label>
                                        <p className="text-sm text-gray-400">
                                            {isEnabled
                                                ? 'User can withdraw Agent PnL rewards'
                                                : 'User is BANNED from withdrawing Agent PnL rewards'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {isEnabled ? (
                                            <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                                                Enabled
                                            </Badge>
                                        ) : (
                                            <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20">
                                                Disabled
                                            </Badge>
                                        )}
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={setIsEnabled}
                                        />
                                    </div>
                                </div>

                                {/* Limit Configuration */}
                                <div className="space-y-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-1">
                                            <Label className="text-base font-medium text-white">
                                                Withdrawal Limit
                                            </Label>
                                            <p className="text-sm text-gray-400">
                                                Set a maximum total amount this user can withdraw
                                            </p>
                                        </div>
                                        <Switch
                                            checked={hasLimit}
                                            onCheckedChange={setHasLimit}
                                        />
                                    </div>

                                    {hasLimit && (
                                        <div className="pt-4 border-t border-gray-700">
                                            <Label className="text-sm text-gray-400 mb-2 block">
                                                Max Limit (USDT)
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="e.g. 1000"
                                                    value={limitUsdt}
                                                    onChange={(e) => setLimitUsdt(e.target.value)}
                                                    className="bg-gray-900 border-gray-700 text-white"
                                                />
                                            </div>
                                            <p className="text-xs text-gray-500 mt-2">
                                                This is a lifetime limit on Agent PnL withdrawals.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Save Button */}
                                <div className="flex justify-end pt-4">
                                    <Button
                                        onClick={handleSave}
                                        disabled={isSaving}
                                        className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                                    >
                                        {isSaving ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        ) : (
                                            <>
                                                <Save className="h-4 w-4 mr-2" />
                                                Save Changes
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
