## Docker Compose 配置文件说明

### 配置矩阵

根据镜像构建方式与缓存依赖需求，配置文件分类如下：

|  部署场景 \ 镜像来源   |                               本地构建                               |                                          GitHub 官方预构建                                           |                                GitHub 官方（南京大学镜像加速）                                 |
| :--------------------: | :------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------: |
| **标准版（无 Redis）** |       [docker-compose.yml](/docker-compose/docker-compose.yml)       |       [docker-compose-prebuild-github.yml](/docker-compose/docker-compose-prebuild-github.yml)       |       [docker-compose-prebuild-nju.yml](/docker-compose/docker-compose-prebuild-nju.yml)       |
| **含 Redis（不推荐）** | [docker-compose-redis.yml](/docker-compose/docker-compose-redis.yml) | [docker-compose-prebuild-github-redis.yml](/docker-compose/docker-compose-prebuild-github-redis.yml) | [docker-compose-prebuild-nju-redis.yml](/docker-compose/docker-compose-prebuild-nju-redis.yml) |

### 版本选择建议

VoiceHub 提供三类主要部署方案，请根据实际环境选择：

**1. 国内个人用户（推荐）**  
建议优先选用 `docker-compose-prebuild-nju.yml`。该配置使用南京大学镜像站加速拉取，可有效改善国内网络环境下的镜像下载体验。

**2. 企业/云服务器部署**  
若您使用具备良好国际出口带宽的国内云服务商（如阿里云、腾讯云等），建议选用 `docker-compose-prebuild-github.yml`，直接拉取 GitHub 官方预构建镜像。

**3. 自定义构建需求**  
如需修改源码、调整依赖或适配私有网络环境，请选用 `docker-compose.yml` 并在本地执行镜像构建。您可根据需要修改 `Dockerfile` 以适配国内软件源等特定环境。

### ⚠️ 关于 Redis 版本的特别提示

当前 Redis 版本存在稳定性问题，**强烈建议避免使用**。如确有缓存需求，请选用带 `-redis` 后缀的配置文件，但需注意相关风险。
