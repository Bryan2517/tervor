# Organization Switch Button - Complete Usage Guide

## 🎯 Overview

The `OrganizationSwitchButton` is a ready-to-use component that provides organization switching functionality in any header. It automatically handles multiple organizations, role display, and switching logic.

## 🚀 Features

### **Smart Display Logic**
- **Single organization**: Shows simple logout button
- **Multiple organizations**: Shows full organization switcher dropdown
- **Current organization**: Always displays current organization with role
- **Role indicators**: Color-coded role badges for easy identification

### **User Experience**
- **Compact design**: Fits well in any header layout
- **Dropdown interface**: Clean dropdown for organization selection
- **Visual feedback**: Loading states and success/error messages
- **Responsive**: Works on all screen sizes

### **Functionality**
- **Organization switching**: One-click switching between organizations
- **Role-based display**: Shows appropriate role for each organization
- **Error handling**: Graceful error handling with user feedback
- **Fallback support**: Works with or without database functions

## 🔧 Basic Usage

### **1. Import the Component**
```typescript
import { OrganizationSwitchButton } from "@/components/dashboard/shared/OrganizationSwitchButton";
```

### **2. Add to Your Header**
```typescript
function MyHeader() {
  const [currentOrganization, setCurrentOrganization] = useState({
    id: "org-1",
    name: "My Organization",
    description: "Organization description",
    logo_url: "/logo.png",
    role: "owner" as const,
  });

  const handleOrganizationChange = (org: any) => {
    setCurrentOrganization(org);
    // Handle organization change logic
  };

  const handleLogout = () => {
    // Handle logout logic
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Your header content */}
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">My App</h1>
          </div>
          
          {/* Organization Switch Button */}
          <div className="flex items-center gap-4">
            <OrganizationSwitchButton 
              currentOrganization={currentOrganization}
              onOrganizationChange={handleOrganizationChange}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
```

## 🎨 Customization Options

### **Custom Styling**
```typescript
<OrganizationSwitchButton 
  currentOrganization={currentOrganization}
  onOrganizationChange={handleOrganizationChange}
  onLogout={handleLogout}
  className="bg-blue-100 hover:bg-blue-200 text-blue-800"
/>
```

### **Different Header Layouts**
```typescript
// Centered layout
<div className="flex items-center justify-center">
  <OrganizationSwitchButton {...props} />
</div>

// Right-aligned layout
<div className="flex items-center justify-end">
  <OrganizationSwitchButton {...props} />
</div>

// With other buttons
<div className="flex items-center gap-4">
  <button>Settings</button>
  <button>Notifications</button>
  <OrganizationSwitchButton {...props} />
</div>
```

## 📱 Component Props

### **Required Props**
```typescript
interface OrganizationSwitchButtonProps {
  currentOrganization: {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    role: UserRole;
  };
  onOrganizationChange: (org: Organization) => void;
  onLogout: () => void;
  className?: string; // Optional custom styling
}
```

### **Props Explanation**
- **`currentOrganization`**: The currently active organization object
- **`onOrganizationChange`**: Callback when user switches organizations
- **`onLogout`**: Callback when user clicks logout
- **`className`**: Optional custom CSS classes for styling

## 🎯 Integration Examples

### **Example 1: Simple Header**
```typescript
function SimpleHeader() {
  const [org, setOrg] = useState({
    id: "1",
    name: "Acme Corp",
    role: "owner" as const,
  });

  return (
    <header className="bg-white border-b">
      <div className="px-4 py-3 flex justify-between items-center">
        <h1>My App</h1>
        <OrganizationSwitchButton 
          currentOrganization={org}
          onOrganizationChange={setOrg}
          onLogout={() => console.log('logout')}
        />
      </div>
    </header>
  );
}
```

### **Example 2: Dashboard Header**
```typescript
function DashboardHeader() {
  const [currentOrg, setCurrentOrg] = useState({
    id: "org-123",
    name: "Tech Startup",
    description: "Innovation Company",
    logo_url: "/startup-logo.png",
    role: "admin" as const,
  });

  const handleOrgChange = (newOrg: any) => {
    setCurrentOrg(newOrg);
    // Refresh dashboard data for new organization
    window.location.reload(); // or use your state management
  };

  const handleLogout = () => {
    // Clear user session and redirect
    localStorage.clear();
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <img src="/logo.png" alt="Logo" className="h-8 w-8" />
            <span className="ml-2 text-xl font-semibold">Dashboard</span>
          </div>
          
          <div className="flex items-center space-x-4">
            <OrganizationSwitchButton 
              currentOrganization={currentOrg}
              onOrganizationChange={handleOrgChange}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
```

### **Example 3: Custom Styled Header**
```typescript
function CustomStyledHeader() {
  const [org, setOrg] = useState({
    id: "1",
    name: "Enterprise Corp",
    role: "supervisor" as const,
  });

  return (
    <header className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Enterprise Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <OrganizationSwitchButton 
              currentOrganization={org}
              onOrganizationChange={setOrg}
              onLogout={() => console.log('logout')}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
```

## 🔄 State Management Integration

### **With React Context**
```typescript
// OrganizationContext.tsx
const OrganizationContext = createContext();

export function OrganizationProvider({ children }) {
  const [currentOrganization, setCurrentOrganization] = useState(null);
  
  const handleOrganizationChange = (org) => {
    setCurrentOrganization(org);
    // Update other context values if needed
  };

  return (
    <OrganizationContext.Provider value={{
      currentOrganization,
      handleOrganizationChange
    }}>
      {children}
    </OrganizationContext.Provider>
  );
}

// Usage in component
function MyHeader() {
  const { currentOrganization, handleOrganizationChange } = useOrganization();
  
  return (
    <header>
      <OrganizationSwitchButton 
        currentOrganization={currentOrganization}
        onOrganizationChange={handleOrganizationChange}
        onLogout={() => {/* logout logic */}}
      />
    </header>
  );
}
```

### **With Redux/Zustand**
```typescript
// With Zustand store
const useOrganizationStore = create((set) => ({
  currentOrganization: null,
  setCurrentOrganization: (org) => set({ currentOrganization: org }),
}));

function MyHeader() {
  const { currentOrganization, setCurrentOrganization } = useOrganizationStore();
  
  return (
    <header>
      <OrganizationSwitchButton 
        currentOrganization={currentOrganization}
        onOrganizationChange={setCurrentOrganization}
        onLogout={() => {/* logout logic */}}
      />
    </header>
  );
}
```

## 🎨 Styling Customization

### **Custom CSS Classes**
```typescript
<OrganizationSwitchButton 
  currentOrganization={org}
  onOrganizationChange={handleChange}
  onLogout={handleLogout}
  className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2"
/>
```

### **Theme Integration**
```typescript
// With Tailwind CSS
<OrganizationSwitchButton 
  currentOrganization={org}
  onOrganizationChange={handleChange}
  onLogout={handleLogout}
  className="bg-primary hover:bg-primary/90 text-primary-foreground"
/>

// With custom CSS
<OrganizationSwitchButton 
  currentOrganization={org}
  onOrganizationChange={handleChange}
  onLogout={handleLogout}
  className="custom-org-switcher"
/>
```

## 🔧 Advanced Usage

### **Custom Organization Change Logic**
```typescript
const handleOrganizationChange = async (newOrg) => {
  // Custom logic before switching
  console.log('Switching from', currentOrganization.name, 'to', newOrg.name);
  
  // Update local state
  setCurrentOrganization(newOrg);
  
  // Update global state
  updateGlobalOrganization(newOrg);
  
  // Refresh data
  await refreshDashboardData(newOrg.id);
  
  // Analytics tracking
  analytics.track('organization_switched', {
    from: currentOrganization.id,
    to: newOrg.id
  });
};
```

### **Error Handling**
```typescript
const handleOrganizationChange = async (newOrg) => {
  try {
    setCurrentOrganization(newOrg);
    await refreshData(newOrg.id);
  } catch (error) {
    console.error('Failed to switch organization:', error);
    // Show error message to user
    toast.error('Failed to switch organization');
  }
};
```

## 📱 Responsive Design

### **Mobile-First Approach**
The component automatically adapts to different screen sizes:

- **Desktop**: Full organization name and role display
- **Tablet**: Truncated organization name
- **Mobile**: Icon-only display with dropdown

### **Custom Responsive Behavior**
```typescript
<OrganizationSwitchButton 
  currentOrganization={org}
  onOrganizationChange={handleChange}
  onLogout={handleLogout}
  className="hidden sm:flex" // Hide on mobile, show on desktop
/>
```

## 🎯 Best Practices

### **1. State Management**
- Keep organization state in a central location
- Use context or state management library for complex apps
- Ensure all components update when organization changes

### **2. Error Handling**
- Always handle organization switching errors
- Provide user feedback for failed operations
- Implement retry logic for network failures

### **3. Performance**
- Debounce organization switching if needed
- Cache organization data to avoid repeated API calls
- Use optimistic updates for better UX

### **4. Accessibility**
- Ensure keyboard navigation works
- Provide screen reader support
- Use proper ARIA labels

## 🚀 Ready to Use!

The `OrganizationSwitchButton` is now ready to use in any header component. It provides:

✅ **Complete organization switching functionality**
✅ **Automatic role display and management**
✅ **Responsive design for all devices**
✅ **Error handling and user feedback**
✅ **Easy integration with any header layout**
✅ **Customizable styling and behavior**

Simply import the component and add it to your header! 🎉
