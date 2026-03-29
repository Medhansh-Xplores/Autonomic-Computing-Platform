output "frontend_repo" {
  value = aws_ecr_repository.frontend.repository_url
}

output "backend_repo" {
  value = aws_ecr_repository.backend.repository_url
}

output "alb_dns" {
  value = aws_lb.ecs.dns_name
}