---
# 新文章的 front matter 模板：hugo new content posts/my-post.md
title: '{{ replace .File.ContentBaseName "-" " " | title }}'
slug: ""                      # 英文短链接，留空则用文件名。中文标题建议填
date: '{{ .Date }}'
draft: true                   # true = 草稿，不会发布
summary: ""                   # 列表页显示的一句话
tags: []
categories: []
ShowToc: true
TocOpen: false
comments: true
---
