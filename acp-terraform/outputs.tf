output "alb_url" {
  description = "ACP Portal URL"
  value       = "http://${aws_lb.acp.dns_name}"
}

output "backend_ecr_url" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.acp_backend.repository_url
}

output "frontend_ecr_url" {
  description = "Frontend ECR repository URL"
  value       = aws_ecr_repository.acp_frontend.repository_url
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.acp.address
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.acp.name
}

output "efs_id" {
  description = "EFS file system ID"
  value       = aws_efs_file_system.acp.id
}