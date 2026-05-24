// components/mcp/StatsCards.tsx
"use client";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Boxes, Database, Settings, Grid3x3, BarChart3 } from "lucide-react";

interface StatsCardsProps {
	stats: {
		total: number;
		crud: number;
		admin: number;
		schema: number;
		analytics: number;
	};
}

export function StatsCards({ stats }: StatsCardsProps) {
	const cards = [
		{
			title: stats.total,
			description: "Total Tools",
			icon: Boxes,
			color: "blue",
		},
		{
			title: stats.crud,
			description: "CRUD Operations",
			icon: Database,
			color: "blue",
		},
		{
			title: stats.admin,
			description: "Administration",
			icon: Settings,
			color: "purple",
		},
		{
			title: stats.schema,
			description: "Schema Fields",
			icon: Grid3x3,
			color: "emerald",
		},
		{
			title: stats.analytics,
			description: "Analytics",
			icon: BarChart3,
			color: "orange",
		},
	];

	const colorClasses = {
		blue: "border-l-blue-500",
		purple: "border-l-purple-500",
		emerald: "border-l-emerald-500",
		orange: "border-l-orange-500",
	};

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-12">
			{cards.map((card) => (
				<Card
					key={card.description}
					className={`border-l-4 ${colorClasses[card.color as keyof typeof colorClasses]} shadow-sm hover:shadow-md transition-all duration-200`}
				>
					<CardHeader className="pb-2">
						<div className="flex items-center justify-between">
							<CardTitle className="text-3xl font-bold text-foreground">
								{card.title}
							</CardTitle>
							<card.icon
								className={`h-5 w-5 text-${card.color}-500 opacity-70`}
							/>
						</div>
						<CardDescription className="text-sm">
							{card.description}
						</CardDescription>
					</CardHeader>
				</Card>
			))}
		</div>
	);
}
