import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Channel, User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Trash2, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ChannelMember {
  id: number;
  userId: number;
  channelId: number;
  joinedAt: Date;
  user?: User;
}

export default function ChannelSettings() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Fetch channel data
  const { data: channel, isLoading: channelLoading } = useQuery<Channel>({
    queryKey: [`/api/channels/${id}`],
    enabled: !!id,
  });

  // Update form fields when channel data loads
  useEffect(() => {
    if (channel) {
      console.log('ChannelSettings - Channel loaded:', channel);
      console.log('ChannelSettings - Setting name:', channel.name);
      console.log('ChannelSettings - Setting description:', channel.description);
      console.log('ChannelSettings - Setting isPrivate:', channel.isPrivate);
      setName(channel.name || "");
      setDescription(channel.description || "");
      setIsPrivate(channel.isPrivate || false);
      console.log('ChannelSettings - Fields updated');
    } else {
      console.log('ChannelSettings - Channel not loaded yet, isLoading:', channelLoading);
    }
  }, [channel, channelLoading]);

  // Fetch channel members
  const { data: members = [], isLoading: membersLoading, refetch: refetchMembers } = useQuery<ChannelMember[]>({
    queryKey: [`/api/channels/${id}/members`],
    enabled: !!id,
  });

  // Fetch all users for adding members
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Update channel mutation
  const updateChannelMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; isPrivate: boolean }) => {
      return await apiRequest(`/api/channels/${id}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Channel updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/channels/${id}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/channels"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update channel",
        variant: "destructive",
      });
    },
  });

  // Add member mutation
  const addMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(`/api/channels/${id}/members`, {
        method: "POST",
        body: { userId },
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Member added successfully",
      });
      setNewMemberEmail("");
      setIsAddingMember(false);
      refetchMembers();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add member",
        variant: "destructive",
      });
    },
  });

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: async (userId: number) => {
      return await apiRequest(`/api/channels/${id}/members/${userId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Member removed successfully",
      });
      refetchMembers();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove member",
        variant: "destructive",
      });
    },
  });

  // Check if user is company_manager
  const { data: currentUserData } = useQuery<User>({
    queryKey: ["/api/auth/user"],
  });

  const isCompanyManager = currentUserData?.role === 'company_manager';

  if (!isCompanyManager) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center p-8">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need company manager privileges to access channel settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation(`/channel/${id}`)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Channel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (channelLoading) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!channel) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Channel Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setLocation("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleUpdateChannel = () => {
    updateChannelMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      isPrivate,
    });
  };

  const handleAddMember = () => {
    const userToAdd = allUsers.find(u => u.email === newMemberEmail.trim());
    if (!userToAdd) {
      toast({
        title: "Error",
        description: "User not found",
        variant: "destructive",
      });
      return;
    }
    addMemberMutation.mutate(userToAdd.id as number);
  };

  const handleRemoveMember = (userId: number) => {
    if (confirm("Are you sure you want to remove this member from the channel?")) {
      removeMemberMutation.mutate(userId);
    }
  };

  const availableUsers = allUsers.filter(
    user => !members.some(m => m.userId === user.id)
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation(`/channel/${id}`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Channel Settings</h1>
            <p className="text-muted-foreground">{channel.name}</p>
          </div>
        </div>

        {/* Channel Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Information</CardTitle>
            <CardDescription>
              Update the basic information for this channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channel-name">Channel Name</Label>
              <Input
                id="channel-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter channel name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="channel-description">Description</Label>
              <Input
                id="channel-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter channel description (optional)"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Private Channel</Label>
                <p className="text-sm text-muted-foreground">
                  Only members you invite can join
                </p>
              </div>
              <Switch
                checked={isPrivate}
                onCheckedChange={setIsPrivate}
              />
            </div>

            <Button
              onClick={handleUpdateChannel}
              disabled={updateChannelMutation.isPending}
              className="w-full"
            >
              {updateChannelMutation.isPending ? "Updating..." : "Update Channel"}
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Channel Members */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Members</CardTitle>
            <CardDescription>
              Manage members who have access to this channel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add Member */}
            {!isAddingMember ? (
              <Button
                variant="outline"
                onClick={() => setIsAddingMember(true)}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="member-email">User Email</Label>
                <div className="flex gap-2">
                  <Input
                    id="member-email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="Enter user email"
                    list="users-list"
                  />
                  <datalist id="users-list">
                    {availableUsers.map(user => (
                      <option key={user.id} value={user.email || ""} />
                    ))}
                  </datalist>
                  <Button
                    onClick={handleAddMember}
                    disabled={addMemberMutation.isPending || !newMemberEmail.trim()}
                  >
                    Add
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsAddingMember(false);
                      setNewMemberEmail("");
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <Separator />

            {/* Members List */}
            {membersLoading ? (
              <p className="text-muted-foreground">Loading members...</p>
            ) : members.length === 0 ? (
              <p className="text-muted-foreground">No members in this channel</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  // Use member.user if available, otherwise find in allUsers
                  const memberUser = member.user || allUsers.find(u => u.id === member.userId);
                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{memberUser?.name || "Unknown User"}</p>
                        <p className="text-sm text-muted-foreground">{memberUser?.email || ""}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
