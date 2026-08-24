# GeoIP 数据库

访客地区（country）由访问 IP 通过本地 GeoLite2 数据库查询得出，不依赖 Vercel/Cloudflare 请求头。

## 获取 GeoLite2-Country.mmdb

1. 注册 MaxMind 免费账号：https://www.maxmind.com/en/geolite2/signup
2. 登录后下载 GeoLite2 Country 数据库（.mmdb 格式，需解压）。
3. 将 `GeoLite2-Country.mmdb` 放到本目录，或通过环境变量 `GEOIP_DB_PATH` 指定其绝对路径。

数据库缺失时地区查询返回空（访客记录显示"未知"），但不影响其它字段采集；如部署在 Vercel/Cloudflare，会回退到平台 geo 头。

建议定期更新该文件以保持准确性。
