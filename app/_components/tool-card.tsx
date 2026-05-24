// components/mcp/ToolCard.tsx
"use client";

import { useState, Activity } from "react";
import {
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Search,
	Plus,
	Pencil,
	Trash2,
	BarChart3,
	Server,
	Table2,
	Key,
	FileText,
	Hash,
	ToggleLeft,
	Calendar,
	List,
	Link,
	Wifi,
	Activity as ActivityIcon,
	Code2,
	FolderTree,
	Eye,
	Shield,
	Check,
	FileJson,
	ArrowRight,
	AlertCircle,
	ChevronDown,
	Globe,
} from "lucide-react";

interface ToolCardProps {
	tool: {
		name: string;
		title?: string;
		description?: string;
		inputSchema?: any;
		outputSchema?: any;
		annotations?: {
			title?: string;
			readOnlyHint?: boolean;
			destructiveHint?: boolean;
			idempotentHint?: boolean;
			openWorldHint?: boolean;
		};
		_meta?: {
			category?: string;
			subcategory?: string;
			operation?: string;
			version?: string;
			author?: string;
		};
	};
}

const getToolIcon = (name: string) => {
	if (name.includes("find")) return <Search className="h-4 w-4" />;
	if (name.includes("insert")) return <Plus className="h-4 w-4" />;
	if (name.includes("update")) return <Pencil className="h-4 w-4" />;
	if (name.includes("delete")) return <Trash2 className="h-4 w-4" />;
	if (name.includes("aggregate")) return <BarChart3 className="h-4 w-4" />;
	if (name.includes("database")) return <Server className="h-4 w-4" />;
	if (name.includes("collection")) return <Table2 className="h-4 w-4" />;
	if (name.includes("index")) return <Key className="h-4 w-4" />;
	if (name.includes("string")) return <FileText className="h-4 w-4" />;
	if (name.includes("number")) return <Hash className="h-4 w-4" />;
	if (name.includes("boolean")) return <ToggleLeft className="h-4 w-4" />;
	if (name.includes("date")) return <Calendar className="h-4 w-4" />;
	if (name.includes("array")) return <List className="h-4 w-4" />;
	if (name.includes("objectId")) return <Link className="h-4 w-4" />;
	if (name.includes("connect")) return <Wifi className="h-4 w-4" />;
	if (name.includes("stats")) return <ActivityIcon className="h-4 w-4" />;
	return <Code2 className="h-4 w-4" />;
};

const getBadgeVariant = (
	tool: ToolCardProps["tool"],
): "default" | "secondary" | "destructive" => {
	if (tool.annotations?.destructiveHint) return "destructive";
	if (tool.annotations?.readOnlyHint) return "secondary";
	return "default";
};

const getBadgeText = (tool: ToolCardProps["tool"]) => {
	if (tool.annotations?.destructiveHint) return "Destructive";
	if (tool.annotations?.readOnlyHint) return "Read Only";
	return "Write";
};

const getOperationStyle = (tool: ToolCardProps["tool"]) => {
	if (tool._meta?.operation === "read") {
		return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400";
	}
	if (tool.annotations?.destructiveHint) {
		return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400";
	}
	return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400";
};

const SchemaProperty = ({
	name,
	property,
	required,
}: {
	name: string;
	property: any;
	required: boolean;
}) => {
	return (
		<div className="border-b border-border last:border-0 pb-3 last:pb-0">
			<div className="flex items-center gap-2 flex-wrap mb-2">
				<code className="text-sm font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded">
					{name}
				</code>
				{required && (
					<Badge variant="destructive" className="text-[10px] px-1.5">
						Required
					</Badge>
				)}
				<Badge
					variant="outline"
					className="text-[10px] px-1.5 font-mono"
				>
					{property.type || property.bsonType || "unknown"}
				</Badge>
			</div>

			{property.description && (
				<Label className="text-xs text-muted-foreground mb-2 block">
					{property.description}
				</Label>
			)}

			{property.enum && (
				<div className="mb-2">
					<Label className="text-xs text-muted-foreground mb-1 block">
						Allowed values:
					</Label>
					<div className="flex flex-wrap gap-1">
						{property.enum.map((v: any) => (
							<Badge
								key={v}
								variant="secondary"
								className="text-[10px] font-mono"
							>
								{String(v)}
							</Badge>
						))}
					</div>
				</div>
			)}

			{(property.minimum !== undefined ||
				property.maximum !== undefined) && (
				<Label className="text-xs text-muted-foreground block">
					Range: {property.minimum ?? "any"} —{" "}
					{property.maximum ?? "any"}
				</Label>
			)}

			{(property.minLength !== undefined ||
				property.maxLength !== undefined) && (
				<Label className="text-xs text-muted-foreground block">
					Length: {property.minLength ?? 0} —{" "}
					{property.maxLength ?? "unlimited"}
				</Label>
			)}

			{property.pattern && (
				<Label className="text-xs text-muted-foreground font-mono block">
					Pattern: {property.pattern}
				</Label>
			)}
		</div>
	);
};

const SchemaSection = ({
	title,
	schema,
	iconColor,
}: {
	title: string;
	schema: any;
	iconColor: "emerald" | "purple";
}) => {
	const [showRawJson, setShowRawJson] = useState(false);

	if (!schema?.properties || Object.keys(schema.properties).length === 0)
		return null;

	const iconColorMap = {
		emerald: "text-emerald-500",
		purple: "text-purple-500",
	};

	return (
		<div className="space-y-3">
			<div className="flex items-center gap-2">
				<ArrowRight className={`h-4 w-4 ${iconColorMap[iconColor]}`} />
				<Label className="text-sm font-semibold">{title}</Label>
				<Badge variant="outline" className="text-[10px] font-mono">
					{schema.type || "object"}
				</Badge>
			</div>

			<div className="rounded-lg border border-border overflow-hidden">
				<div className="bg-muted px-4 py-2 border-b border-border">
					<Label className="text-xs font-mono font-medium">
						Properties
					</Label>
				</div>
				<ScrollArea className="max-h-96 overflow-auto">
					<div className="p-4 space-y-3">
						{Object.entries(schema.properties).map(
							([key, value]: [string, any]) => (
								<SchemaProperty
									key={key}
									name={key}
									property={value}
									required={(schema.required || []).includes(
										key,
									)}
								/>
							),
						)}
					</div>
				</ScrollArea>
			</div>

			<Button
				variant="ghost"
				size="sm"
				onClick={() => setShowRawJson(!showRawJson)}
				className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-auto p-1"
			>
				<ChevronDown
					className={`h-3 w-3 transition-transform ${
						showRawJson ? "rotate-180" : ""
					}`}
				/>
				{showRawJson ? "Hide Raw JSON" : "View Raw JSON"}
			</Button>

			<Activity mode={showRawJson ? "visible" : "hidden"}>
				<div className="rounded-lg border border-border">
					<div className="bg-muted px-4 py-2 border-b border-border">
						<Label className="text-xs font-mono font-medium">
							Raw JSON
						</Label>
					</div>
					<div className="max-h-96 overflow-auto">
						<pre className="p-4 text-[11px] font-mono text-foreground bg-muted/50 whitespace-pre-wrap break-words">
							{JSON.stringify(schema, null, 2)}
						</pre>
					</div>
				</div>
			</Activity>
		</div>
	);
};

export function ToolCard({ tool }: ToolCardProps) {
	const hasInputSchema =
		tool.inputSchema?.properties &&
		Object.keys(tool.inputSchema.properties).length > 0;
	const hasOutputSchema =
		tool.outputSchema?.properties &&
		Object.keys(tool.outputSchema.properties).length > 0;
	const hasNoSchema = !hasInputSchema && !hasOutputSchema;
	const operationStyle = getOperationStyle(tool);

	return (
		<AccordionItem
			value={tool.name}
			className="border rounded-lg bg-card border-border shadow-sm hover:shadow-md transition-all"
		>
			<AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-accent transition-colors [&[data-state=open]>div>.chevron]:rotate-90">
				<div className="flex items-start justify-between w-full gap-4">
					<div className="flex items-start gap-4">
						<div className="p-2.5 rounded-xl bg-secondary text-secondary-foreground">
							{getToolIcon(tool.name)}
						</div>
						<div className="text-left">
							<div className="flex items-center gap-2 flex-wrap mb-1.5">
								<Label className="font-mono font-semibold text-foreground text-base">
									{tool.name}
								</Label>
								<Badge
									variant={getBadgeVariant(tool)}
									className="text-xs"
								>
									{getBadgeText(tool)}
								</Badge>
								{tool.annotations?.title && (
									<Badge
										variant="outline"
										className="text-xs"
									>
										{tool.annotations.title}
									</Badge>
								)}
								{tool._meta?.version && (
									<Badge
										variant="outline"
										className="text-xs font-mono"
									>
										v{tool._meta.version}
									</Badge>
								)}
								{tool._meta?.author && (
									<Badge
										variant="outline"
										className="text-xs gap-1"
									>
										<Shield className="h-3 w-3" />
										{tool._meta.author}
									</Badge>
								)}
							</div>

							<div className="flex items-center gap-3 mt-2">
								{tool._meta?.category && (
									<Label className="flex items-center gap-1 text-xs text-muted-foreground">
										<FolderTree className="h-3 w-3" />
										<span className="capitalize">
											{tool._meta.category}
										</span>
										{tool._meta.subcategory && (
											<>
												<span className="text-muted-foreground/50">
													/
												</span>
												<span className="capitalize">
													{tool._meta.subcategory}
												</span>
											</>
										)}
									</Label>
								)}

								{tool._meta?.operation && (
									<Label
										className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${operationStyle}`}
									>
										{tool._meta.operation === "read" ? (
											<Eye className="h-3 w-3" />
										) : (
											<Pencil className="h-3 w-3" />
										)}
										<span className="capitalize">
											{tool._meta.operation}
										</span>
									</Label>
								)}

								{tool.annotations?.idempotentHint && (
									<Label className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
										<Check className="h-3 w-3" />
										Idempotent
									</Label>
								)}

								{tool.annotations?.openWorldHint && (
									<Label className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
										<Globe className="h-3 w-3" />
										Open World
									</Label>
								)}
							</div>
						</div>
					</div>
				</div>
			</AccordionTrigger>

			<AccordionContent className="px-6 pb-6 pt-2 h-auto">
				<Separator className="mb-6" />

				<div className="space-y-6">
					<Activity
						mode={
							tool.description || tool.title
								? "visible"
								: "hidden"
						}
					>
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<FileJson className="h-4 w-4 text-primary" />
								<Label className="text-sm font-semibold">
									Description
								</Label>
							</div>
							<Label className="text-sm text-muted-foreground leading-relaxed pl-6 block">
								{tool.description || tool.title}
							</Label>
						</div>
					</Activity>

					<Activity mode={hasInputSchema ? "visible" : "hidden"}>
						<SchemaSection
							title="Input Schema"
							schema={tool.inputSchema}
							iconColor="emerald"
						/>
					</Activity>

					<Activity mode={hasOutputSchema ? "visible" : "hidden"}>
						<SchemaSection
							title="Output Schema"
							schema={tool.outputSchema}
							iconColor="purple"
						/>
					</Activity>

					<Activity mode={hasNoSchema ? "visible" : "hidden"}>
						<div className="text-center py-6">
							<AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-30" />
							<Label className="text-sm text-muted-foreground block">
								No schema information available
							</Label>
							<Label className="text-xs text-muted-foreground mt-1 block">
								This tool may not require input parameters or
								returns dynamic results
							</Label>
						</div>
					</Activity>
				</div>
			</AccordionContent>
		</AccordionItem>
	);
}