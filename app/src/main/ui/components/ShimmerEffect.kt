package com.example.swastik.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Shimmer effect modifier for loading placeholders.
 * Apply this to any Box/Column to give it a shimmering loading appearance.
 */
@Composable
fun shimmerBrush(): Brush {
    val shimmerColors = listOf(
        Color(0xFFE0E0E0),
        Color(0xFFF5F5F5),
        Color(0xFFE0E0E0)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnimation = transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(
                durationMillis = 1200,
                easing = FastOutSlowInEasing
            ),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    return Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnimation.value, y = translateAnimation.value)
    )
}

/**
 * A rectangular shimmer placeholder
 */
@Composable
fun ShimmerBox(
    modifier: Modifier = Modifier,
    height: Dp = 20.dp,
    cornerRadius: Dp = 8.dp
) {
    Box(
        modifier = modifier
            .height(height)
            .clip(RoundedCornerShape(cornerRadius))
            .background(shimmerBrush())
    )
}

/**
 * A circular shimmer placeholder
 */
@Composable
fun ShimmerCircle(
    modifier: Modifier = Modifier,
    size: Dp = 40.dp
) {
    Box(
        modifier = modifier
            .size(size)
            .clip(CircleShape)
            .background(shimmerBrush())
    )
}

/**
 * Dashboard Home Tab shimmer loading placeholder
 * Mimics the structure of the real home content while loading
 */
@Composable
fun HomeDashboardShimmer(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        // Header shimmer
        Row(modifier = Modifier.fillMaxWidth()) {
            ShimmerCircle(size = 45.dp)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                ShimmerBox(modifier = Modifier.fillMaxWidth(0.5f), height = 16.dp)
                Spacer(modifier = Modifier.height(6.dp))
                ShimmerBox(modifier = Modifier.fillMaxWidth(0.3f), height = 12.dp)
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Search bar shimmer
        ShimmerBox(modifier = Modifier.fillMaxWidth(), height = 48.dp, cornerRadius = 24.dp)

        Spacer(modifier = Modifier.height(24.dp))

        // Main cards shimmer (3 cards in a row)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            repeat(3) {
                ShimmerBox(
                    modifier = Modifier
                        .weight(1f),
                    height = 100.dp,
                    cornerRadius = 16.dp
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Reminders section shimmer
        ShimmerBox(modifier = Modifier.fillMaxWidth(0.4f), height = 18.dp)
        Spacer(modifier = Modifier.height(12.dp))
        ShimmerBox(modifier = Modifier.fillMaxWidth(), height = 70.dp, cornerRadius = 12.dp)

        Spacer(modifier = Modifier.height(24.dp))

        // Quick actions grid shimmer (2x3)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            repeat(4) {
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally
                ) {
                    ShimmerCircle(size = 50.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.8f), height = 10.dp)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Doctor recommendation shimmer
        ShimmerBox(modifier = Modifier.fillMaxWidth(0.5f), height = 18.dp)
        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            repeat(2) {
                ShimmerBox(
                    modifier = Modifier.weight(1f),
                    height = 120.dp,
                    cornerRadius = 16.dp
                )
            }
        }
    }
}

/**
 * Medicine tab shimmer loading placeholder
 */
@Composable
fun MedicineListShimmer(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        // Category chips shimmer
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            repeat(4) {
                ShimmerBox(
                    modifier = Modifier.width(80.dp),
                    height = 32.dp,
                    cornerRadius = 16.dp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Medicine cards shimmer
        repeat(4) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
            ) {
                ShimmerBox(
                    modifier = Modifier.size(60.dp),
                    cornerRadius = 12.dp
                )
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.7f), height = 16.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.5f), height = 12.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.3f), height = 14.dp)
                }
            }
        }
    }
}

/**
 * Records tab shimmer loading placeholder
 */
@Composable
fun RecordsListShimmer(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(20.dp)
    ) {
        // Section header shimmer
        ShimmerBox(modifier = Modifier.fillMaxWidth(0.5f), height = 18.dp)
        Spacer(modifier = Modifier.height(16.dp))

        // Consultation cards shimmer
        repeat(3) {
            ShimmerBox(
                modifier = Modifier.fillMaxWidth(),
                height = 90.dp,
                cornerRadius = 12.dp
            )
            Spacer(modifier = Modifier.height(12.dp))
        }

        Spacer(modifier = Modifier.height(8.dp))
        ShimmerBox(modifier = Modifier.fillMaxWidth(0.4f), height = 18.dp)
        Spacer(modifier = Modifier.height(16.dp))

        repeat(2) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 6.dp)
            ) {
                ShimmerCircle(size = 40.dp)
                Spacer(modifier = Modifier.width(12.dp))
                Column(modifier = Modifier.weight(1f)) {
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.6f), height = 14.dp)
                    Spacer(modifier = Modifier.height(6.dp))
                    ShimmerBox(modifier = Modifier.fillMaxWidth(0.4f), height = 12.dp)
                }
            }
        }
    }
}
