## docker-compose.yml 说明

| 分类维度\镜像来源       | 本地制作镜像                | GitHub 官方预构建镜像       | GitHub 官方+南京大学镜像加速 |
| :--------------------- | :-------------------------- | :-------------------------- | :--------------------------- |
| **不含 Redis**         | [docker-compose.yml](/docker-compose/docker-compose.yml) | [docker-compose-prebuild-github.yml](/docker-compose/docker-compose-prebuild-github.yml) | [docker-compose-prebuild-nju.yml](/docker-compose/docker-compose-prebuild-nju.yml) |
| **含 Redis（不建议用）** | [docker-compose-redis.yml](/docker-compose/docker-compose-redis.yml) | [docker-compose-prebuild-github-redis.yml](/docker-compose/docker-compose-prebuild-github-redis.yml) | [docker-compose-prebuild-nju-redis.yml](/docker-compose/docker-compose-prebuild-nju-redis.yml) |


首先，对于 voicehub 这个镜像来说，`docker-compose`分为三大类，即 `docker-compose.yml`（需本地制作镜像）、`docker-compose-prebuild-github.yml`（使用官方制作并托管在github上的镜像）、`docker-compose-prebuild-nju.yml`（使用官方制作并托管在github上、南京大学镜像加速的镜像）。

无特殊需求的国内个人用户最后使用 `docker-compose-prebuild-nju.yml`，用国内厂商部署的可以使用 `docker-compose-prebuild-github.yml`，需要自己制作镜像部署的使用 `docker-compose.yml`

特别地，如果你要使用带 redis 数据库（目前redis有问题，**特别不建议使用**）的版本，使用带 redis 后缀的 yml。