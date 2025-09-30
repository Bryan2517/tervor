import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Building2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Organization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
}

export function OrganizationSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchOrganization();
  }, []);

  const fetchOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("organization_members")
        .select("organization:organizations(*)")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (data?.organization) {
        setOrganization(data.organization as Organization);
        setFormData({
          name: data.organization.name || "",
          description: data.organization.description || "",
        });
      }
    } catch (error) {
      console.error("Error fetching organization:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          description: formData.description,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Organization settings updated successfully",
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Organization Settings</h1>
              <p className="text-sm text-muted-foreground">Manage your organization details</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Details
            </CardTitle>
            <CardDescription>
              Update your organization information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter organization name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter organization description"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Organization Logo</Label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                  {organization?.logo_url ? (
                    <img src={organization.logo_url} alt="Logo" className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <Building2 className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <Button variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Logo
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" onClick={() => navigate("/")}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
