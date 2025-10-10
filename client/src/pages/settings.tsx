import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Users, Settings as SettingsIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { User } from "@shared/schema";

export default function Settings() {
  const [, setLocation] = useLocation();

  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const isAdmin = currentUser?.role === 'admin';

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need admin privileges to access workspace settings.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const adminCount = users.filter(u => u.role === 'admin').length;
  const memberCount = users.filter(u => u.role === 'member').length;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-settings">Workspace Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your workspace configuration and members
          </p>
        </div>

        <Separator />

        {/* Workspace Overview */}
        <Card data-testid="card-workspace-overview">
          <CardHeader>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              <CardTitle>Workspace Overview</CardTitle>
            </div>
            <CardDescription>
              General information about your workspace
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Members</p>
                <p className="text-2xl font-semibold" data-testid="text-total-members">{users.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Online Now</p>
                <p className="text-2xl font-semibold" data-testid="text-online-members">
                  {users.filter(u => u.isOnline).length}
                </p>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-chart-1" />
                  <span className="text-sm">Administrators</span>
                </div>
                <span className="font-semibold" data-testid="text-admin-count">{adminCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">Members</span>
                </div>
                <span className="font-semibold" data-testid="text-member-count">{memberCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Member Management */}
        <Card data-testid="card-member-management">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              <CardTitle>Member Management</CardTitle>
            </div>
            <CardDescription>
              Manage workspace members and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => setLocation('/members')}
              data-testid="button-manage-members"
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Members
            </Button>
          </CardContent>
        </Card>

        {/* Admin Info */}
        <Card className="border-chart-1/20" data-testid="card-admin-info">
          <CardHeader>
            <CardTitle className="text-sm">Admin Access</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              You have administrator privileges in this workspace. You can manage members, 
              change roles, and configure workspace settings.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
