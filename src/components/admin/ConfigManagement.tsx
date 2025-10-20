import React, { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/contexts/wallet-context';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Users, 
  Percent, 
  DollarSign, 
  Calendar,
  TrendingUp,
  Save,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { type Config } from '@/lib/solairus-main';
import { createConfigService, type SetConfigArgs } from '@/services/config/config-service';

interface RoleAddresses extends Record<string, string> {
  admin: string;
  marketer1: string;
  marketer2: string;
  trader: string;
  systemreserve: string;
}

interface LicensePercentages extends Record<string, number> {
  admin: number;
  dev: number;
  marketer1: number;
  marketer2: number;
  reserve: number;
  affL1: number;
  affL2: number;
  affL3: number;
}

interface AgentPercentages extends Record<string, number> {
  admin: number;
  dev: number;
  marketer1: number;
  marketer2: number;
  trader: number;
  reserve: number;
  affL1: number;
  affL2: number;
  affL3: number;
}

interface SystemParameters {
  activationFeeUsdt: string;
  roiDailyBps: number;
  licenseDurationDays: number;
}

/**
 * Configuration management interface restricted to dev role
 */
export const ConfigManagement: React.FC = () => {
  const { publicKey, anchorProvider } = useWallet();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Config | null>(null);
  
  // Form state
  const [roleAddresses, setRoleAddresses] = useState<RoleAddresses>({
    admin: '',
    marketer1: '',
    marketer2: '',
    trader: '',
    systemreserve: '',
  });
  
  const [licensePercentages, setLicensePercentages] = useState<LicensePercentages>({
    admin: 0,
    dev: 0,
    marketer1: 0,
    marketer2: 0,
    reserve: 0,
    affL1: 0,
    affL2: 0,
    affL3: 0,
  });
  
  const [agentPercentages, setAgentPercentages] = useState<AgentPercentages>({
    admin: 0,
    dev: 0,
    marketer1: 0,
    marketer2: 0,
    trader: 0,
    reserve: 0,
    affL1: 0,
    affL2: 0,
    affL3: 0,
  });
  
  const [systemParameters, setSystemParameters] = useState<SystemParameters>({
    activationFeeUsdt: '0',
    roiDailyBps: 0,
    licenseDurationDays: 365,
  });

  // Load current configuration
  const loadConfiguration = useCallback(async () => {
    if (!anchorProvider) return;
    
    setLoading(true);
    try {
      const configService = createConfigService(anchorProvider);
      const configData = await configService.getConfig();
      setConfig(configData);
      
      // Populate form with current values
      setRoleAddresses({
        admin: configData.admin.toString(),
        marketer1: configData.marketer1.toString(),
        marketer2: configData.marketer2.toString(),
        trader: configData.trader.toString(),
        systemreserve: configData.systemreserve.toString(),
      });
      
      setLicensePercentages({
        admin: configData.licenseAdminPct,
        dev: configData.licenseDevPct,
        marketer1: configData.licenseMarketer1Pct,
        marketer2: configData.licenseMarketer2Pct,
        reserve: configData.licenseReservePct,
        affL1: configData.licenseAffL1Pct,
        affL2: configData.licenseAffL2Pct,
        affL3: configData.licenseAffL3Pct,
      });
      
      setAgentPercentages({
        admin: configData.agentAdminPct,
        dev: configData.agentDevPct,
        marketer1: configData.agentMarketer1Pct,
        marketer2: configData.agentMarketer2Pct,
        trader: configData.agentTraderPct,
        reserve: configData.agentReservePct,
        affL1: configData.agentAffL1Pct,
        affL2: configData.agentAffL2Pct,
        affL3: configData.agentAffL3Pct,
      });
      
      setSystemParameters({
        activationFeeUsdt: configData.activationFeeUsdt.toString(),
        roiDailyBps: configData.roiDailyBps,
        licenseDurationDays: configData.licenseDurationDays,
      });
      
    } catch (error) {
      console.error('Error loading configuration:', error);
      toast({
        title: 'Error',
        description: 'Failed to load configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [anchorProvider, toast]);

  // Save configuration changes
  const saveConfiguration = async () => {
    if (!anchorProvider || !publicKey) return;
    
    const configService = createConfigService(anchorProvider);
    
    // Validate percentages
    const percentageValidation = configService.validatePercentages(licensePercentages, agentPercentages);
    if (!percentageValidation.isValid) {
      toast({
        title: 'Validation Error',
        description: percentageValidation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }
    
    // Validate addresses
    const addressValidation = configService.validateAddresses(roleAddresses);
    if (!addressValidation.isValid) {
      toast({
        title: 'Validation Error',
        description: addressValidation.errors.join(', '),
        variant: 'destructive',
      });
      return;
    }
    
    setSaving(true);
    try {
      const setConfigArgs: SetConfigArgs = {
        activationFeeUsdt: new anchor.BN(systemParameters.activationFeeUsdt),
        roiDailyBps: systemParameters.roiDailyBps,
        licenseDurationDays: systemParameters.licenseDurationDays,
        // Role addresses (use default if empty)
        admin: roleAddresses.admin ? new PublicKey(roleAddresses.admin) : PublicKey.default,
        marketer1: roleAddresses.marketer1 ? new PublicKey(roleAddresses.marketer1) : PublicKey.default,
        marketer2: roleAddresses.marketer2 ? new PublicKey(roleAddresses.marketer2) : PublicKey.default,
        trader: roleAddresses.trader ? new PublicKey(roleAddresses.trader) : PublicKey.default,
        systemreserve: roleAddresses.systemreserve ? new PublicKey(roleAddresses.systemreserve) : PublicKey.default,
        // License percentages
        licenseAdminPct: licensePercentages.admin,
        licenseDevPct: licensePercentages.dev,
        licenseMarketer1Pct: licensePercentages.marketer1,
        licenseMarketer2Pct: licensePercentages.marketer2,
        licenseReservePct: licensePercentages.reserve,
        licenseAffL1Pct: licensePercentages.affL1,
        licenseAffL2Pct: licensePercentages.affL2,
        licenseAffL3Pct: licensePercentages.affL3,
        // Agent percentages
        agentAdminPct: agentPercentages.admin,
        agentDevPct: agentPercentages.dev,
        agentMarketer1Pct: agentPercentages.marketer1,
        agentMarketer2Pct: agentPercentages.marketer2,
        agentTraderPct: agentPercentages.trader,
        agentReservePct: agentPercentages.reserve,
        agentAffL1Pct: agentPercentages.affL1,
        agentAffL2Pct: agentPercentages.affL2,
        agentAffL3Pct: agentPercentages.affL3,
      };
      
      const txSignature = await configService.setConfig(publicKey, setConfigArgs);
      
      toast({
        title: 'Success',
        description: `Configuration updated successfully. Transaction: ${txSignature}`,
      });
      
      // Reload configuration to reflect changes
      await loadConfiguration();
      
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: 'Error',
        description: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration();
  }, [loadConfiguration]);

  // Calculate percentage sums for validation
  const licenseSum = Object.values(licensePercentages).reduce((sum, val) => sum + val, 0);
  const agentSum = Object.values(agentPercentages).reduce((sum, val) => sum + val, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-green-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">System Configuration</h1>
            <p className="text-gray-400">Manage system settings and parameters (Dev Only)</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={loadConfiguration}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button
            onClick={saveConfiguration}
            disabled={saving || loading || licenseSum !== 100 || agentSum !== 100}
            className="flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Role Addresses Configuration */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Role Addresses</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(roleAddresses).map(([role, address]) => (
            <div key={role} className="space-y-2">
              <Label htmlFor={`role-${role}`} className="text-gray-300 capitalize">
                {role} Address
              </Label>
              <Input
                id={`role-${role}`}
                value={address}
                onChange={(e) => setRoleAddresses(prev => ({
                  ...prev,
                  [role]: e.target.value
                }))}
                placeholder="Enter public key address"
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* System Parameters */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <DollarSign className="h-6 w-6 text-yellow-400" />
          <h2 className="text-xl font-semibold text-white">System Parameters</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="activation-fee" className="text-gray-300">
              Activation Fee (USDT)
            </Label>
            <Input
              id="activation-fee"
              type="number"
              value={systemParameters.activationFeeUsdt}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                activationFeeUsdt: e.target.value
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="roi-bps" className="text-gray-300">
              ROI Daily (BPS)
            </Label>
            <Input
              id="roi-bps"
              type="number"
              value={systemParameters.roiDailyBps}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                roiDailyBps: parseInt(e.target.value) || 0
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="license-duration" className="text-gray-300">
              License Duration (Days)
            </Label>
            <Input
              id="license-duration"
              type="number"
              value={systemParameters.licenseDurationDays}
              onChange={(e) => setSystemParameters(prev => ({
                ...prev,
                licenseDurationDays: parseInt(e.target.value) || 365
              }))}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>
      </Card>

      {/* License Percentages */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Percent className="h-6 w-6 text-green-400" />
            <h2 className="text-xl font-semibold text-white">License Distribution Percentages</h2>
          </div>
          <Badge 
            variant={licenseSum === 100 ? "default" : "destructive"}
            className="text-sm"
          >
            Total: {licenseSum}%
          </Badge>
        </div>
        
        {licenseSum !== 100 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">
              License percentages must sum to exactly 100%
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(licensePercentages).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`license-${key}`} className="text-gray-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              <Input
                id={`license-${key}`}
                type="number"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setLicensePercentages(prev => ({
                  ...prev,
                  [key]: parseInt(e.target.value) || 0
                }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Agent Percentages */}
      <Card className="p-6 bg-gray-800 border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-6 w-6 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Agent Distribution Percentages</h2>
          </div>
          <Badge 
            variant={agentSum === 100 ? "default" : "destructive"}
            className="text-sm"
          >
            Total: {agentSum}%
          </Badge>
        </div>
        
        {agentSum !== 100 && (
          <div className="flex items-center gap-2 mb-4 p-3 bg-red-900/20 border border-red-700 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <span className="text-red-400 text-sm">
              Agent percentages must sum to exactly 100%
            </span>
          </div>
        )}
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(agentPercentages).map(([key, value]) => (
            <div key={key} className="space-y-2">
              <Label htmlFor={`agent-${key}`} className="text-gray-300 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </Label>
              <Input
                id={`agent-${key}`}
                type="number"
                min="0"
                max="100"
                value={value}
                onChange={(e) => setAgentPercentages(prev => ({
                  ...prev,
                  [key]: parseInt(e.target.value) || 0
                }))}
                className="bg-gray-700 border-gray-600 text-white"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Current Configuration Display */}
      {config && (
        <Card className="p-6 bg-gray-800 border-gray-700">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="h-6 w-6 text-gray-400" />
            <h2 className="text-xl font-semibold text-white">Current Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Dev Address:</span>
              <p className="text-white font-mono text-xs break-all">{config.dev.toString()}</p>
            </div>
            <div>
              <span className="text-gray-400">USDT Mint:</span>
              <p className="text-white font-mono text-xs break-all">{config.usdtMint.toString()}</p>
            </div>
            <div>
              <span className="text-gray-400">Current Fee:</span>
              <p className="text-white">{config.activationFeeUsdt.toString()} USDT</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};