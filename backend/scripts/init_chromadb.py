#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""初始化 ChromaDB SOP 知识库"""

import sys
import os

# 添加 backend 路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.chroma_service import get_chroma_service, SOP_DOCUMENTS


def main():
    print("=" * 60)
    print("ChromaDB SOP 知识库初始化")
    print("=" * 60)
    
    # 获取 ChromaDB 服务
    chroma = get_chroma_service()
    
    # 检查连接
    try:
        info = chroma.client.get_version()
        print(f"[✓] ChromaDB 连接成功，版本: {info}")
    except Exception as e:
        print(f"[✗] ChromaDB 连接失败: {e}")
        return
    
    # 初始化 SOP 集合
    print("\n[1] 初始化 SOP 知识库...")
    count = chroma.init_sop_collection(force=True)
    print(f"    插入 {count} 条 SOP 记录")
    
    # 验证数据
    print("\n[2] 验证数据...")
    collection_info = chroma.get_collection_info()
    print(f"    Collection: {collection_info.get('name', 'N/A')}")
    print(f"    记录数: {collection_info.get('count', 0)}")
    
    # 测试搜索
    print("\n[3] 测试搜索功能...")
    test_queries = [
        "车辆碰撞交通事故",
        "道路坑洼损坏",
        "交通拥堵",
        "行人闯入",
        "道路障碍物遗撒",
    ]
    
    for query in test_queries:
        results = chroma.search(query, top_k=2)
        print(f"\n    查询: {query}")
        if results:
            for r in results:
                text = r.get("text", "")[:80]
                dist = r.get("distance", 0)
                print(f"      - [{r.get('id', 'N/A')}] dist={dist:.3f}")
                print(f"        {text}...")
        else:
            print("      (无结果)")
    
    print("\n" + "=" * 60)
    print("初始化完成!")
    print("=" * 60)


if __name__ == "__main__":
    main()
