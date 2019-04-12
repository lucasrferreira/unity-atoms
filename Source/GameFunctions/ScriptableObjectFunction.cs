using System;
using UnityEngine;

namespace UnityAtoms
{
    public abstract class GameFunction<R> : ScriptableObject
    {
        [HideInInspector]
        public Func<R> Func;

        public virtual R Call()
        {
            if (Func != null)
            {
                return Func();
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }

    public abstract class GameFunction<R, T1> : ScriptableObject
    {
        [HideInInspector]
        public Func<T1, R> func;

        public virtual R Call(T1 t1)
        {
            if (func != null)
            {
                return func(t1);
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }

    public abstract class GameFunction<R, T1, T2> : ScriptableObject
    {
        [HideInInspector]
        public Func<T1, T2, R> func;

        public virtual R Call(T1 t1, T2 t2)
        {
            if (func != null)
            {
                return func(t1, t2);
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }

    public abstract class GameFunction<R, T1, T2, T3> : ScriptableObject
    {
        [HideInInspector]
        public Func<T1, T2, T3, R> func;

        public virtual R Call(T1 t1, T2 t2, T3 t3)
        {
            if (func != null)
            {
                return func(t1, t2, t3);
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }

    public abstract class GameFunction<R, T1, T2, T3, T4> : ScriptableObject
    {
        [HideInInspector]
        public Func<T1, T2, T3, T4, R> func;

        public virtual R Call(T1 t1, T2 t2, T3 t3, T4 t4)
        {
            if (func != null)
            {
                return func(t1, t2, t3, t4);
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }

    public abstract class GameFunction<R, T1, T2, T3, T4, T5> : ScriptableObject
    {
        [HideInInspector]
        public Func<T1, T2, T3, T4, T5, R> func;

        public virtual R Call(T1 t1, T2 t2, T3 t3, T4 t4, T5 t5)
        {
            if (func != null)
            {
                return func(t1, t2, t3, t4, t5);
            }

            throw new Exception("Either set Func or override the Call method.");
        }
    }
}
