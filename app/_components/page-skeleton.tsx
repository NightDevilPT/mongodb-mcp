// app/_components/page-skeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function PageSkeleton() {
	return (
		<div className="min-h-screen bg-background">
			{/* Navigation Skeleton */}
			<nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-lg">
				<div className="container mx-auto px-4 sm:px-6 lg:px-8">
					<div className="flex h-16 items-center justify-between">
						<div className="flex items-center gap-3">
							<Skeleton className="h-9 w-9 rounded-xl" />
							<div className="space-y-1.5">
								<Skeleton className="h-4 w-40" />
								<Skeleton className="h-3 w-32" />
							</div>
						</div>
						<div className="flex items-center gap-3">
							<Skeleton className="h-8 w-28 rounded-lg" />
							<Skeleton className="h-8 w-24 rounded-lg" />
						</div>
					</div>
				</div>
			</nav>

			<main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
				{/* Hero Section Skeleton */}
				<div className="text-center max-w-4xl mx-auto mb-16">
					<Skeleton className="h-8 w-64 rounded-full mx-auto mb-6" />
					<div className="space-y-3 mb-6">
						<Skeleton className="h-14 w-96 mx-auto" />
					</div>
					<div className="space-y-2 max-w-2xl mx-auto">
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-4/5 mx-auto" />
					</div>
					<div className="flex justify-center mt-8">
						<Skeleton className="h-10 w-48 rounded-lg" />
					</div>
				</div>

				{/* Stats Cards Skeleton */}
				<div className="grid gap-4 md:grid-cols-5 mb-12">
					{Array.from({ length: 5 }).map((_, i) => (
						<Card key={i}>
							<CardContent className="p-4">
								<div className="space-y-3">
									<div className="flex items-center justify-between">
										<Skeleton className="h-4 w-20" />
										<Skeleton className="h-8 w-8 rounded-lg" />
									</div>
									<Skeleton className="h-8 w-12" />
									<Skeleton className="h-3 w-24" />
								</div>
							</CardContent>
						</Card>
					))}
				</div>

				{/* Tools Section Skeleton */}
				<section className="space-y-8">
					<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
						<div className="space-y-2">
							<div className="flex items-center gap-2">
								<Skeleton className="h-6 w-6 rounded" />
								<Skeleton className="h-8 w-48" />
							</div>
							<Skeleton className="h-4 w-64" />
						</div>
						<Skeleton className="h-10 w-full sm:w-80 rounded-lg" />
					</div>

					{/* Category Filters Skeleton */}
					<div className="flex flex-wrap gap-2">
						{Array.from({ length: 5 }).map((_, i) => (
							<Skeleton key={i} className="h-9 w-28 rounded-lg" />
						))}
					</div>

					{/* Tools Accordion Skeleton */}
					<div className="space-y-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<Card key={i}>
								<CardContent className="p-6">
									<div className="flex items-start gap-4">
										<Skeleton className="h-10 w-10 rounded-xl" />
										<div className="flex-1 space-y-3">
											<div className="flex items-center gap-2">
												<Skeleton className="h-5 w-40" />
												<Skeleton className="h-5 w-20 rounded-full" />
												<Skeleton className="h-5 w-16 rounded-full" />
											</div>
											<div className="flex items-center gap-3">
												<Skeleton className="h-4 w-24" />
												<Skeleton className="h-5 w-20 rounded-md" />
												<Skeleton className="h-4 w-20" />
											</div>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</section>

				{/* Features Section Skeleton */}
				<div className="mt-12">
					<Skeleton className="h-px w-full my-12" />
					<div className="grid gap-6 md:grid-cols-3">
						{Array.from({ length: 3 }).map((_, i) => (
							<Card key={i}>
								<CardContent className="flex gap-4 p-4">
									<Skeleton className="h-12 w-12 rounded-xl" />
									<div className="flex-1 space-y-2">
										<Skeleton className="h-5 w-32" />
										<Skeleton className="h-4 w-full" />
										<Skeleton className="h-4 w-3/4" />
									</div>
								</CardContent>
							</Card>
						))}
					</div>
					<Skeleton className="h-px w-full my-8" />

					{/* Footer Skeleton */}
					<div className="flex flex-col sm:flex-row justify-between items-center gap-3 py-4">
						<div className="flex items-center gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-4" />
							<Skeleton className="h-4 w-32" />
						</div>
						<Skeleton className="h-4 w-32" />
					</div>
				</div>
			</main>
		</div>
	);
}
