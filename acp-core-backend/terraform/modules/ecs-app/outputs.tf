output "frontend_ecr_url" {
  description = "Frontend ECR repository URL"
  value       = aws_ecr_repository.frontend.repository_url
}

output "backend_ecr_url" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "frontend_service_name" {
  description = "ECS service name for the frontend"
  value       = aws_ecs_service.frontend.name
}

output "backend_service_name" {
  description = "ECS service name for the backend"
  value       = aws_ecs_service.backend.name
}
