// app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Accordion } from "@/components/ui/accordion";
import {
	Database,
	Search,
	Boxes,
	Settings,
	Grid3x3,
	BarChart3,
	BookOpen,
	Shield,
	Clock,
	GitBranch,
	Activity,
	Loader2,
	Wifi,
	WifiOff,
	RefreshCw,
	Copy,
	Terminal,
	Rocket,
	Check,
} from "lucide-react";
import { StatsCards } from "./_components/stats-card";
import { ToolCard } from "./_components/tool-card";
import { PageSkeleton } from "./_components/page-skeleton";

interface Tool {
	name: string;
	title?: string;
	description?: string;
	inputSchema?: any;
	outputSchema?: any;
	annotations?: {
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		idempotentHint?: boolean;
	};
	_meta?: {
		category?: string;
		subcategory?: string;
		operation?: string;
		version?: string;
		author?: string;
	};
}

export default function Home() {
	const [tools, setTools] = useState<Tool[]>([]);
	const [loading, setLoading] = useState(true);
	const [connected, setConnected] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [activeCategory, setActiveCategory] = useState("all");
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	const fetchTools = useCallback(async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch("/api/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json, text/event-stream",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					method: "tools/list",
					params: {},
					id: 1,
				}),
			});

			const text = await response.text();
			const lines = text.split("\n");
			let jsonData = "";

			for (const line of lines) {
				if (line.startsWith("data: ")) {
					jsonData = line.substring(6);
					break;
				}
			}

			if (jsonData) {
				const data = JSON.parse(jsonData);
				if (data.result?.tools) {
					setTools(data.result.tools);
					setConnected(true);
				} else {
					throw new Error("No tools found");
				}
			} else {
				throw new Error("No data received");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Connection failed");
			setConnected(false);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchTools();
	}, [fetchTools]);

	const getCategory = (tool: Tool): string => {
		const cat = tool._meta?.category;
		if (cat === "database") return "Admin";
		if (cat === "crud") return "CRUD";
		if (cat === "schema") return "Schema";
		if (cat === "query") return "Analytics";
		return "Other";
	};

	const filteredTools = tools.filter((tool) => {
		const category = getCategory(tool);
		const matchCategory =
			activeCategory === "all" || category === activeCategory;
		const matchSearch =
			searchQuery === "" ||
			tool.name.toLowerCase().includes(searchQuery.toLowerCase());
		return matchCategory && matchSearch;
	});

	const stats = {
		total: tools.length,
		crud: tools.filter((t) => getCategory(t) === "CRUD").length,
		admin: tools.filter((t) => getCategory(t) === "Admin").length,
		schema: tools.filter((t) => getCategory(t) === "Schema").length,
		analytics: tools.filter((t) => getCategory(t) === "Analytics").length,
	};

	const categories = [
		{ id: "all", name: "All Tools", icon: Boxes, count: stats.total },
		{ id: "CRUD", name: "CRUD", icon: Database, count: stats.crud },
		{ id: "Admin", name: "Admin", icon: Settings, count: stats.admin },
		{ id: "Schema", name: "Schema", icon: Grid3x3, count: stats.schema },
		{
			id: "Analytics",
			name: "Analytics",
			icon: BarChart3,
			count: stats.analytics,
		},
	];

	const handleCopyEndpoint = async () => {
		await navigator.clipboard.writeText(
			`${window.location.origin}/api/mcp`,
		);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (loading) {
		return <PageSkeleton />;
	}

	return (
		<div className="min-h-screen bg-background">
			{/* Navigation */}
			<nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
								<Database className="h-5 w-5 text-primary-foreground" />
							</div>
							<div>
								<Label className="font-semibold text-foreground">
									MongoDB MCP Server
								</Label>
								<Label className="text-xs text-muted-foreground block">
									Model Context Protocol v1.0.0
								</Label>
							</div>
						</div>
						<div className="flex items-center gap-3">
							<div
								className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${
									connected
										? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
										: "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
								}`}
							>
								{connected ? (
									<Wifi className="h-3.5 w-3.5" />
								) : (
									<WifiOff className="h-3.5 w-3.5" />
								)}
								<span>
									{connected ? "Connected" : "Disconnected"}
								</span>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={fetchTools}
								className="gap-2"
								disabled={loading}
							>
								<RefreshCw
									className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
								/>
								Refresh
							</Button>
						</div>
					</div>
				</div>
			</nav>

			<main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{/* Hero Section */}
				<div className="text-center max-w-4xl mx-auto mb-16">
					<div className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-sm font-medium text-secondary-foreground border mb-6">
						<Rocket className="h-4 w-4" />
						<span>Enterprise-Grade Database Management</span>
					</div>
					<h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
						<span className="text-foreground">MongoDB</span>
						<span className="text-primary"> MCP Server</span>
					</h1>
					<Label className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed block">
						A comprehensive Model Context Protocol server providing
						full database management capabilities — CRUD operations,
						schema validation, aggregation pipelines, and complete
						database administration.
					</Label>
					<div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
						<div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted border font-mono text-sm">
							<code className="text-foreground">
								POST /api/mcp
							</code>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 px-2"
								onClick={handleCopyEndpoint}
							>
								{copied ? (
									<Check className="h-3.5 w-3.5 text-emerald-500" />
								) : (
									<Copy className="h-3.5 w-3.5" />
								)}
							</Button>
						</div>
					</div>
				</div>

				{/* Error State */}
				{error && (
					<Card className="mb-8 border-destructive/50 bg-destructive/10">
						<CardContent className="py-8 text-center">
							<div className="flex flex-col items-center gap-3">
								<div className="h-12 w-12 rounded-full bg-destructive/20 flex items-center justify-center">
									<WifiOff className="h-6 w-6 text-destructive" />
								</div>
								<div>
									<Label className="text-destructive font-medium mb-1 block">
										Connection Failed
									</Label>
									<Label className="text-sm text-muted-foreground block">
										{error}
									</Label>
								</div>
								<Button
									onClick={fetchTools}
									variant="outline"
									className="gap-2 mt-2"
								>
									<RefreshCw className="h-4 w-4" />
									Retry Connection
								</Button>
							</div>
						</CardContent>
					</Card>
				)}

				{/* Stats Dashboard */}
				{!error && tools.length > 0 && <StatsCards stats={stats} />}

				{/* Tools Section */}
				{!error && tools.length > 0 && (
					<section className="space-y-8">
						<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
							<div>
								<div className="flex items-center gap-2">
									<BookOpen className="h-6 w-6 text-primary" />
									<h2 className="text-2xl font-bold tracking-tight">
										Available Tools
									</h2>
								</div>
								<Label className="text-sm text-muted-foreground mt-1 block">
									{filteredTools.length} tool
									{filteredTools.length !== 1 ? "s" : ""}{" "}
									available for MongoDB management
								</Label>
							</div>
							<div className="relative w-full sm:w-80">
								<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									placeholder="Search tools by name..."
									value={searchQuery}
									onChange={(e) =>
										setSearchQuery(e.target.value)
									}
									className="pl-9"
								/>
							</div>
						</div>

						{/* Category Filters */}
						<div className="flex flex-wrap gap-2">
							{categories
								.filter(
									(cat) => cat.count > 0 || cat.id === "all",
								)
								.map((cat) => {
									const Icon = cat.icon;
									const isActive = activeCategory === cat.id;
									return (
										<Button
											key={cat.id}
											variant={
												isActive ? "default" : "outline"
											}
											size="sm"
											onClick={() =>
												setActiveCategory(cat.id)
											}
											className="gap-2"
										>
											<Icon className="h-4 w-4" />
											{cat.name}
											<Badge
												variant={
													isActive
														? "secondary"
														: "outline"
												}
												className="text-xs px-1.5"
											>
												{cat.count}
											</Badge>
										</Button>
									);
								})}
						</div>

						{/* Tools Accordion */}
						{filteredTools.length === 0 ? (
							<Card className="border-dashed">
								<CardContent className="py-16 text-center">
									<Search className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-30" />
									<Label className="text-muted-foreground font-medium block">
										No tools found
									</Label>
									<Label className="text-sm text-muted-foreground mt-1 block">
										Try adjusting your search criteria
									</Label>
								</CardContent>
							</Card>
						) : (
							<Accordion
								type="single"
								collapsible
								className="space-y-3"
							>
								{filteredTools.map((tool) => (
									<ToolCard key={tool.name} tool={tool} />
								))}
							</Accordion>
						)}
					</section>
				)}

				{/* Features Section */}
				{!error && tools.length > 0 && (
					<>
						<Separator className="my-12" />

						<div className="grid gap-6 md:grid-cols-3">
							<Card>
								<CardContent className="flex gap-4 p-4">
									<div className="p-3 rounded-xl bg-primary/10 h-fit">
										<Shield className="h-5 w-5 text-primary" />
									</div>
									<div>
										<h3 className="font-semibold mb-1">
											Schema Validation
										</h3>
										<Label className="text-sm text-muted-foreground leading-relaxed block">
											Full MongoDB $jsonSchema support
											with type enforcement and validation
											rules
										</Label>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="flex gap-4 p-4">
									<div className="p-3 rounded-xl bg-emerald-500/10 h-fit">
										<Clock className="h-5 w-5 text-emerald-500" />
									</div>
									<div>
										<h3 className="font-semibold mb-1">
											Auto Timestamps
										</h3>
										<Label className="text-sm text-muted-foreground leading-relaxed block">
											Automatic createdAt and updatedAt
											field management
										</Label>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="flex gap-4 p-4">
									<div className="p-3 rounded-xl bg-purple-500/10 h-fit">
										<GitBranch className="h-5 w-5 text-purple-500" />
									</div>
									<div>
										<h3 className="font-semibold mb-1">
											Aggregation Pipeline
										</h3>
										<Label className="text-sm text-muted-foreground leading-relaxed block">
											Complex queries with $match, $group,
											$lookup, and more
										</Label>
									</div>
								</CardContent>
							</Card>
						</div>

						<Separator className="my-8" />

						{/* Footer */}
						<footer className="flex flex-col sm:flex-row justify-between items-center gap-3 py-4 text-xs text-muted-foreground">
							<div className="flex items-center gap-4">
								<span className="font-medium">
									MongoDB MCP Server
								</span>
								<span>•</span>
								<span>Model Context Protocol</span>
								<span>•</span>
								<span>{tools.length} Tools Registered</span>
							</div>
							<div className="flex items-center gap-2">
								<Activity className="h-3 w-3" />
								<span>POST /api/mcp</span>
							</div>
						</footer>
					</>
				)}
			</main>
		</div>
	);
}
