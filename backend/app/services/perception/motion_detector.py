"""帧差法运动检测模块 - 检测视频帧中的运动区域"""
from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import cv2
import numpy as np
from PIL import Image


@dataclass
class MotionROI:
    """检测到的运动区域 (Region of Interest)"""
    bbox: Tuple[int, int, int, int]  # (x1, y1, x2, y2)
    area: float  # 面积(像素)
    centroid: Tuple[int, int]  # 中心点 (cx, cy)
    aspect_ratio: float  # 宽高比


class MotionDetector:
    """基于帧差法的运动目标检测器
    
    算法流程:
    1. 灰度化当前帧
    2. 高斯模糊去噪
    3. 与上一帧做帧差
    4. 二值化阈值分割
    5. 形态学开闭运算
    6. 轮廓检测与面积过滤
    7. 返回候选ROI列表
    """

    def __init__(
        self,
        threshold: int = 25,
        min_area: int = 500,
        max_area: int = 50000,
        blur_size: int = 5,
        morph_size: int = 5,
    ):
        """初始化运动检测器
        
        Args:
            threshold: 帧差阈值 (默认25)
            min_area: 最小运动区域面积(像素) (过滤噪点)
            max_area: 最大运动区域面积(像素) (过滤全屏变化)
            blur_size: 高斯模糊核大小
            morph_size: 形态学核大小
        """
        self.threshold = threshold
        self.min_area = min_area
        self.max_area = max_area
        self.blur_size = blur_size
        self.morph_size = morph_size
        self.prev_gray: Optional[np.ndarray] = None

    def detect(self, frame: np.ndarray) -> List[MotionROI]:
        """检测单帧中的运动区域
        
        Args:
            frame: BGR格式的numpy数组 (H, W, 3)
            
        Returns:
            运动区域列表 (MotionROI)
        """
        # Step 1: 灰度化
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        
        # Step 2: 高斯模糊
        gray = cv2.GaussianBlur(gray, (self.blur_size, self.blur_size), 0)
        
        if self.prev_gray is None:
            self.prev_gray = gray
            return []
        
        # Step 3: 帧差计算
        diff = cv2.absdiff(self.prev_gray, gray)
        
        # Step 4: 二值化
        _, thresh = cv2.threshold(diff, self.threshold, 255, cv2.THRESH_BINARY)
        
        # Step 5: 形态学处理 (开运算去噪点 + 闭运算填空洞)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (self.morph_size, self.morph_size))
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel)
        thresh = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
        
        # Step 6: 轮廓检测
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Step 7: 面积过滤 + 构建ROI列表
        rois = []
        for contour in contours:
            area = cv2.contourArea(contour)
            if self.min_area <= area <= self.max_area:
                x, y, w, h = cv2.boundingRect(contour)
                M = cv2.moments(contour)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                else:
                    cx, cy = x + w // 2, y + h // 2
                
                rois.append(MotionROI(
                    bbox=(x, y, x + w, y + h),
                    area=area,
                    centroid=(cx, cy),
                    aspect_ratio=w / h if h > 0 else 0,
                ))
        
        self.prev_gray = gray
        return rois

    def crop_roi(self, frame: np.ndarray, roi: MotionROI, padding: int = 10) -> np.ndarray:
        """裁剪ROI区域
        
        Args:
            frame: 原始帧
            roi: 运动区域
            padding: 扩展padding
            
        Returns:
            裁剪后的图像
        """
        x1, y1, x2, y2 = roi.bbox
        h, w = frame.shape[:2]
        
        # 添加padding
        x1 = max(0, x1 - padding)
        y1 = max(0, y1 - padding)
        x2 = min(w, x2 + padding)
        y2 = min(h, y2 + padding)
        
        return frame[y1:y2, x1:x2]

    def get_motion_info(self, frame: np.ndarray, rois: List[MotionROI]) -> dict:
        """获取运动信息摘要
        
        Args:
            frame: 当前帧
            rois: 检测到的运动区域
            
        Returns:
            运动信息字典
        """
        if not rois:
            return {
                "motion_detected": False,
                "roi_count": 0,
                "total_area": 0,
                "dominant_roi": None,
            }
        
        total_area = sum(roi.area for roi in rois)
        dominant_roi = max(rois, key=lambda r: r.area)
        
        return {
            "motion_detected": True,
            "roi_count": len(rois),
            "total_area": total_area,
            "total_area_ratio": total_area / (frame.shape[0] * frame.shape[1]),
            "dominant_roi": {
                "bbox": dominant_roi.bbox,
                "area": dominant_roi.area,
                "centroid": dominant_roi.centroid,
            },
        }

    def reset(self):
        """重置内部状态 (清空上一帧)"""
        self.prev_gray = None


def test_with_video(video_path: str, max_frames: int = 100):
    """使用视频测试帧差法
    
    Args:
        video_path: 视频文件路径
        max_frames: 最大测试帧数
    """
    import time
    
    detector = MotionDetector(
        threshold=25,
        min_area=500,
        max_area=50000,
    )
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"无法打开视频: {video_path}")
        return
    
    frame_count = 0
    total_time = 0
    
    while frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        
        start_time = time.time()
        rois = detector.detect(frame)
        elapsed = time.time() - start_time
        total_time += elapsed
        
        if frame_count % 10 == 0:
            motion_info = detector.get_motion_info(frame, rois)
            print(f"帧 {frame_count}: ROI数量={motion_info['roi_count']}, "
                  f"总面积={motion_info['total_area']:.0f}, "
                  f"耗时={elapsed*1000:.1f}ms")
        
        frame_count += 1
    
    cap.release()
    avg_time = (total_time / frame_count * 1000) if frame_count > 0 else 0
    print(f"\n统计: 共处理 {frame_count} 帧, 平均耗时 {avg_time:.1f}ms/帧")
    print(f"视频路径: {video_path}")


if __name__ == "__main__":
    # 测试视频路径
    test_video = "/Users/jasonlee/UAV_PRO/website/backend/data/streams/DJI_0025_cut1.Mp4"
    
    print("=" * 60)
    print("帧差法运动检测测试")
    print("=" * 60)
    test_with_video(test_video, max_frames=50)
