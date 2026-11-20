"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function TabsShell({ tabs, defaultValue, className }: {
  tabs: Array<{ value: string; label: string; content: React.ReactNode; badge?: string }>;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <Tabs defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <TabsList>
        {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}{tab.badge ? <span className="rounded-full bg-navy-100 px-1.5 py-0.5 text-[10px]">{tab.badge}</span> : null}</TabsTrigger>)}
      </TabsList>
      {tabs.map((tab) => <TabsContent key={tab.value} value={tab.value}>{tab.content}</TabsContent>)}
    </Tabs>
  );
}
